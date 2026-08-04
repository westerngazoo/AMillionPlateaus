// drive-folder.test.mjs — one tap from a topic to its Drive notes folder (R-0109).
import test from "node:test";
import assert from "node:assert/strict";

import {
  FOLDER_PREFIX,
  slugifyTopic,
  driveFolderName,
  driveSearchUrl,
  isDriveFolderUrl,
  isDriveUrl,
  topicFolder,
  describeFolder,
} from "./drive-folder.js";

test("slugifyTopic folds accents and punctuation — the Spanish course names", () => {
  assert.equal(slugifyTopic("Introducción al cálculo"), "introduccion-al-calculo");
  assert.equal(slugifyTopic("Óptica"), "optica");
  assert.equal(slugifyTopic("Álgebra Superior"), "algebra-superior");
  assert.equal(slugifyTopic("GA view: Óptica — reflection and refraction as versors").slice(0, 20), "ga-view-optica-refle");
  assert.equal(slugifyTopic("Lógica y Conjuntos"), "logica-y-conjuntos");
  assert.equal(slugifyTopic(""), "");
  assert.equal(slugifyTopic(null), "");
});

test("slugifyTopic never leaves stray hyphens at the ends", () => {
  assert.equal(slugifyTopic("  ¿Qué es esto?  "), "que-es-esto");
  assert.equal(slugifyTopic("---weird---"), "weird");
});

test("driveFolderName follows the plateaus-<topic> convention", () => {
  assert.equal(driveFolderName("Introducción al cálculo"), "plateaus-introduccion-al-calculo");
  assert.equal(driveFolderName("Óptica"), "plateaus-optica");
  assert.equal(driveFolderName("Óptica", "notas"), "notas-optica");
  // a nameless topic still yields a usable folder name, never "plateaus-"
  assert.equal(driveFolderName(""), FOLDER_PREFIX);
});

test("the same topic always derives the same name (stable across devices)", () => {
  const a = driveFolderName("Introducción al cálculo");
  const b = driveFolderName("introduccion al calculo"); // typed without accents
  assert.equal(a, b, "accents and case cannot fork the folder name");
});

test("driveSearchUrl is a plain deep link — no auth, no API", () => {
  const url = driveSearchUrl("plateaus-optica");
  assert.equal(url, "https://drive.google.com/drive/search?q=plateaus-optica");
  // encoding is real encoding, so a name with spaces can't break the URL
  assert.match(driveSearchUrl("a b&c"), /q=a%20b%26c/);
});

test("isDriveFolderUrl distinguishes folders from files and other links", () => {
  assert.ok(isDriveFolderUrl("https://drive.google.com/drive/folders/1IiHhMSDlHePkek"));
  assert.ok(isDriveFolderUrl("https://drive.google.com/drive/u/0/folders/1IiHhMSDlHePkek"));
  assert.ok(!isDriveFolderUrl("https://drive.google.com/file/d/1ItRBEdL/view"), "a file is not a folder");
  assert.ok(!isDriveFolderUrl("https://docs.google.com/document/d/1eHIA/edit"), "a doc is not a folder");
  assert.ok(!isDriveFolderUrl("https://example.com/drive/folders/x"), "only Google origins");
  assert.ok(!isDriveFolderUrl("http://drive.google.com/drive/folders/x"), "https only");
  assert.ok(!isDriveFolderUrl(null));
});

test("isDriveUrl covers Drive files and Google Docs alike", () => {
  assert.ok(isDriveUrl("https://docs.google.com/spreadsheets/d/1fDZ/edit"));
  assert.ok(isDriveUrl("https://drive.google.com/file/d/197l/view"));
  assert.ok(!isDriveUrl("https://youtube.com/watch?v=x"));
});

test("a PINNED folder wins over the derived convention", () => {
  const shelf = [
    { id: "r1", title: "Cálculo textbooks", kind: "Link", uri: "https://drive.google.com/file/d/xyz/view" },
    { id: "r2", title: "My intro-calc notes", kind: "Link", uri: "https://drive.google.com/drive/folders/ABC123" },
  ];
  const f = topicFolder("Introducción al cálculo", shelf);
  assert.equal(f.kind, "pinned");
  assert.equal(f.url, "https://drive.google.com/drive/folders/ABC123");
  assert.equal(f.title, "My intro-calc notes");
  // the derived name is still reported, so the UI can offer to create/rename
  assert.equal(f.name, "plateaus-introduccion-al-calculo");
});

test("with nothing pinned it falls back to the derived Drive search", () => {
  const f = topicFolder("Óptica", []);
  assert.equal(f.kind, "derived");
  assert.equal(f.name, "plateaus-optica");
  assert.equal(f.url, "https://drive.google.com/drive/search?q=plateaus-optica");
  // a shelf with only non-folder links is still 'derived'
  const g = topicFolder("Óptica", [{ id: "x", uri: "https://youtube.com/watch?v=1" }]);
  assert.equal(g.kind, "derived");
  assert.deepEqual(topicFolder("Óptica", null).kind, "derived");
});

test("describeFolder says plainly what the tap will do", () => {
  assert.match(describeFolder(topicFolder("Óptica", [])), /Search Drive for plateaus-optica/);
  const pinned = topicFolder("Óptica", [
    { id: "r", title: "Óptica notes", uri: "https://drive.google.com/drive/folders/Z" },
  ]);
  assert.match(describeFolder(pinned), /Open Óptica notes in Drive/);
  assert.equal(describeFolder(null), "");
});
