// Minimal reference data for local dev — enough to exercise the schema
// (chapters/questions need a real subject_id/class_id to attach to).
// Idempotent: safe to run more than once.
export const seed = async (client) => {
  await client.query(`
    INSERT INTO subjects (name) VALUES
      ('Physics'), ('Chemistry'), ('Mathematics')
    ON CONFLICT (name) DO NOTHING
  `);

  await client.query(`
    INSERT INTO classes (name) VALUES
      ('Class 11'), ('Class 12'), ('Dropper')
    ON CONFLICT (name) DO NOTHING
  `);

  await client.query(`
    INSERT INTO exams (name) VALUES
      ('JEE Main'), ('JEE Advanced')
    ON CONFLICT (name) DO NOTHING
  `);

  await client.query(`
    INSERT INTO years (value) VALUES
      (2020), (2021), (2022), (2023), (2024)
    ON CONFLICT (value) DO NOTHING
  `);
};
