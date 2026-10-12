<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$storageDir = null;
$storageCandidates = [];
$homeDir = getenv('HOME');
if ($homeDir) {
    $storageCandidates[] = rtrim($homeDir, '/\\') . '/food-court-tracker-data';
}
$processUser = function_exists('posix_geteuid') && function_exists('posix_getpwuid')
    ? @posix_getpwuid(posix_geteuid()) : false;
if (is_array($processUser) && !empty($processUser['dir'])) {
    $storageCandidates[] = rtrim($processUser['dir'], '/\\') . '/food-court-tracker-data';
}
$storageCandidates[] = dirname(__DIR__) . '/food-court-tracker-data';
$storageCandidates[] = __DIR__;
$storageCandidates[] = rtrim(sys_get_temp_dir(), '/\\') . '/food-court-tracker-' . md5(__FILE__);

foreach ($storageCandidates as $candidate) {
    if (!is_dir($candidate) && !@mkdir($candidate, 0700, true)) {
        continue;
    }
    if (is_dir($candidate) && is_writable($candidate)) {
        $storageDir = $candidate;
        break;
    }
}

if ($storageDir === null) {
    http_response_code(500);
    echo json_encode(["error" => "PHP nemá zapisovatelnou datovou složku."]);
    exit();
}

$dbFile = $storageDir . '/foodcourt.sqlite';
$jsonFile = $storageDir . '/foodcourt-data.json';
$db = null;
$useSqlite = false;

if (class_exists('PDO') && in_array('sqlite', PDO::getAvailableDrivers(), true)) {
    try {
        $db = new PDO("sqlite:" . $dbFile);
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        // Aktuální stav podniku pro rychlé načtení aplikace.
        $db->exec("CREATE TABLE IF NOT EXISTS venues (
            id TEXT PRIMARY KEY,
            visited INTEGER DEFAULT 0,
            rating INTEGER DEFAULT 0,
            note TEXT DEFAULT '',
            date TEXT DEFAULT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )");

        // Historie změn se nemaže; každý rozdíl se uloží jako samostatná akce.
        $db->exec("CREATE TABLE IF NOT EXISTS venue_actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            venue_id TEXT NOT NULL,
            action TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )");
        $useSqlite = true;
    } catch (Exception $e) {
        $db = null;
    }
}

function readJsonStore($file) {
    if (!is_file($file)) {
        return ['venues' => [], 'actions' => []];
    }
    $contents = file_get_contents($file);
    $store = json_decode($contents, true);
    return is_array($store) ? array_merge(['venues' => [], 'actions' => []], $store) : ['venues' => [], 'actions' => []];
}

function writeJsonStore($file, $store) {
    $json = json_encode($store, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    return $json !== false && file_put_contents($file, $json, LOCK_EX) !== false;
}

$method = $_SERVER['REQUEST_METHOD'];

// GET: Vráti stav všetkých podnikov vo formáte pre app.js { venues: { kfc: {...}, ... } }
if ($method === 'GET') {
    try {
        if ($useSqlite) {
            $stmt = $db->query("SELECT id, visited, rating, note, date FROM venues");
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $venues = [];
            foreach ($rows as $row) {
                $venues[$row['id']] = [
                    'visited' => (bool)$row['visited'],
                    'rating'  => (int)$row['rating'],
                    'note'    => (string)$row['note'],
                    'date'    => $row['date'] ?: null
                ];
            }
        } else {
            $store = readJsonStore($jsonFile);
            $venues = $store['venues'];
        }

        echo json_encode(['venues' => $venues]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["error" => "Chyba pri čítaní dát."]);
    }
    exit();
}

// POST: Uloží alebo zaktualizuje záznam konkrétneho podniku
if ($method === 'POST') {
    $raw = file_get_contents("php://input");
    $data = json_decode($raw, true);

    // Smazání celého postupu; historie změn zůstává zachována.
    if (is_array($data) && !empty($data['clear'])) {
        try {
            if ($useSqlite) {
                $db->beginTransaction();
                $db->exec("INSERT INTO venue_actions (venue_id, action, old_value, new_value)
                    SELECT id, 'clear', visited, NULL FROM venues");
                $db->exec("DELETE FROM venues");
                $db->commit();
            } else {
                $store = readJsonStore($jsonFile);
                foreach (array_keys($store['venues']) as $vid) {
                    $store['actions'][] = ['venue_id' => $vid, 'action' => 'clear',
                        'old_value' => null, 'new_value' => null, 'created_at' => gmdate('c')];
                }
                $store['venues'] = [];
                if (!writeJsonStore($jsonFile, $store)) throw new RuntimeException('write');
            }
            echo json_encode(["success" => true]);
        } catch (Exception $e) {
            if ($useSqlite && $db->inTransaction()) $db->rollBack();
            http_response_code(500);
            echo json_encode(["error" => "Chyba při mazání dat."]);
        }
        exit();
    }

    if (empty($data['id'])) {
        http_response_code(400);
        echo json_encode(["error" => "Chýba identifikátor podniku 'id'."]);
        exit();
    }

    $id      = trim(strip_tags((string)$data['id']));
    $visited = !empty($data['visited']) ? 1 : 0;
    $rating  = isset($data['rating']) ? (int)$data['rating'] : 0;
    $note    = isset($data['note']) ? trim(strip_tags($data['note'])) : '';
    $date    = !empty($data['date']) ? trim(strip_tags($data['date'])) : null;

    if ($id === '' || strlen($id) > 100 || $rating < 0 || $rating > 5) {
        http_response_code(400);
        echo json_encode(["error" => "Neplatná data podniku."]);
        exit();
    }

    if ($date !== null && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        http_response_code(400);
        echo json_encode(["error" => "Datum musí být ve formátu RRRR-MM-DD."]);
        exit();
    }

    try {
        if ($useSqlite) {
            $db->beginTransaction();
            $oldStmt = $db->prepare("SELECT visited, rating, note, date FROM venues WHERE id = :id");
            $oldStmt->execute([':id' => $id]);
            $old = $oldStmt->fetch(PDO::FETCH_ASSOC) ?: [
                'visited' => 0, 'rating' => 0, 'note' => '', 'date' => null
            ];

            $stmt = $db->prepare("INSERT INTO venues (id, visited, rating, note, date, updated_at)
                VALUES (:id, :visited, :rating, :note, :date, CURRENT_TIMESTAMP)
                ON CONFLICT(id) DO UPDATE SET
                    visited = excluded.visited,
                    rating = excluded.rating,
                    note = excluded.note,
                    date = excluded.date,
                    updated_at = CURRENT_TIMESTAMP");
            $stmt->execute([
                ':id' => $id, ':visited' => $visited, ':rating' => $rating,
                ':note' => $note, ':date' => $date
            ]);
        } else {
            $store = readJsonStore($jsonFile);
            $old = isset($store['venues'][$id]) ? $store['venues'][$id] : [
                'visited' => 0, 'rating' => 0, 'note' => '', 'date' => null
            ];
            $store['venues'][$id] = [
                'visited' => (bool)$visited, 'rating' => $rating,
                'note' => $note, 'date' => $date
            ];
        }

        $changes = [
            'visited' => [(int)$old['visited'], $visited],
            'rating'  => [(int)$old['rating'], $rating],
            'note'    => [(string)$old['note'], $note],
            'date'    => [$old['date'] ?: null, $date]
        ];
        $actionStmt = $useSqlite ? $db->prepare("INSERT INTO venue_actions
            (venue_id, action, old_value, new_value)
            VALUES (:venue_id, :action, :old_value, :new_value)") : null;
        foreach ($changes as $action => [$oldValue, $newValue]) {
            if ($oldValue !== $newValue) {
                if ($useSqlite) {
                    $actionStmt->execute([
                        ':venue_id' => $id, ':action' => $action,
                        ':old_value' => $oldValue === null ? null : (string)$oldValue,
                        ':new_value' => $newValue === null ? null : (string)$newValue
                    ]);
                } else {
                    $store['actions'][] = [
                        'venue_id' => $id, 'action' => $action,
                        'old_value' => $oldValue, 'new_value' => $newValue,
                        'created_at' => gmdate('c')
                    ];
                }
            }
        }
        if ($useSqlite) {
            $db->commit();
        } elseif (!writeJsonStore($jsonFile, $store)) {
            throw new RuntimeException('Nelze zapsat JSON databázi.');
        }

        echo json_encode(["success" => true, "id" => $id]);
    } catch (Exception $e) {
        if ($useSqlite && $db->inTransaction()) {
            $db->rollBack();
        }
        http_response_code(500);
        echo json_encode(["error" => "Chyba při zápisu do databáze."]);
    }
    exit();
}

http_response_code(405);
echo json_encode(["error" => "Nepovolená metóda."]);