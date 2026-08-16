import { SYSTEM_ADMIN_EMAIL } from './003_system_admin.seed.js';

// Pilot content for Physics · Class 11 · "Motion in a Straight Line" —
// 30 hand-written, independently-verified questions (15 JEE Main
// single-correct, 15 JEE Advanced split across single-correct/multi-correct/
// numerical), assembled into 2 practice sets (15Q each, one per exam label)
// and 1 full mock (25Q, mixed). This demonstrates the exam-type filtering +
// timed question-set engine end-to-end; scale content up by following the
// same shape once this is reviewed.
//
// answerType: 'single_correct' | 'multi_correct' | 'numerical'
// options: [{ text, correct }] — omitted entirely for numerical questions.

const MAIN = [
  {
    text: 'A car starts from rest and accelerates uniformly at 2 m/s² for 5 s. What is its velocity at t = 5 s?',
    difficulty: 'easy',
    options: [{ text: '5 m/s' }, { text: '10 m/s', correct: true }, { text: '15 m/s' }, { text: '20 m/s' }],
    explanation: 'v = u + at = 0 + 2 × 5 = 10 m/s.',
  },
  {
    text: 'A particle has initial velocity 5 m/s and uniform deceleration 1 m/s². What distance does it cover in the first 4 seconds?',
    difficulty: 'medium',
    options: [{ text: '8 m' }, { text: '10 m' }, { text: '12 m', correct: true }, { text: '16 m' }],
    explanation:
      's = ut + ½at² = 5(4) − ½(1)(16) = 20 − 8 = 12 m. The particle only comes to rest at t = u/a = 5 s, so it is still moving forward throughout these 4 s.',
  },
  {
    text: 'The displacement–time graph of a particle moving with constant velocity is a:',
    difficulty: 'easy',
    options: [{ text: 'Parabola' }, { text: 'Straight line', correct: true }, { text: 'Circle' }, { text: 'Hyperbola' }],
    explanation: 'x = x₀ + vt is linear in t, so the graph is a straight line.',
  },
  {
    text: 'The area under a velocity–time graph gives:',
    difficulty: 'easy',
    options: [{ text: 'Acceleration' }, { text: 'Displacement', correct: true }, { text: 'Jerk' }, { text: 'Force' }],
    explanation: '∫v dt = displacement, by definition.',
  },
  {
    text: 'A body is dropped from rest and falls freely under gravity (g = 10 m/s²). Distance fallen in the first 3 s?',
    difficulty: 'medium',
    options: [{ text: '30 m' }, { text: '45 m', correct: true }, { text: '60 m' }, { text: '90 m' }],
    explanation: 's = ½gt² = ½(10)(9) = 45 m.',
  },
  {
    text: 'A ball is thrown vertically upward with speed 20 m/s (g = 10 m/s²). Time taken to reach maximum height?',
    difficulty: 'medium',
    options: [{ text: '1 s' }, { text: '2 s', correct: true }, { text: '4 s' }, { text: '5 s' }],
    explanation: 'At the top, v = 0 = u − gt, so t = u/g = 20/10 = 2 s.',
  },
  {
    text: 'Two trains move in the same direction with speeds 72 km/h and 54 km/h. The relative velocity of the faster train with respect to the slower one is:',
    difficulty: 'medium',
    options: [{ text: '5 m/s', correct: true }, { text: '10 m/s' }, { text: '18 m/s' }, { text: '35 m/s' }],
    explanation: '72 km/h = 20 m/s, 54 km/h = 15 m/s. Relative velocity = 20 − 15 = 5 m/s.',
  },
  {
    text: 'The average speed of a moving body over an interval is always:',
    difficulty: 'easy',
    options: [
      { text: 'Equal to its average velocity' },
      { text: 'Greater than or equal to the magnitude of its average velocity', correct: true },
      { text: 'Less than its average velocity' },
      { text: 'Equal to its instantaneous speed' },
    ],
    explanation:
      'Distance ≥ |displacement| over any interval, so average speed = distance/time ≥ |average velocity| = |displacement|/time.',
  },
  {
    text: 'A particle covers the first half of a distance at 3 m/s. It covers the remaining half in two equal time intervals, moving at 4.5 m/s and 7.5 m/s respectively. Find its average speed for the entire journey.',
    difficulty: 'hard',
    options: [{ text: '3 m/s' }, { text: '4 m/s', correct: true }, { text: '5 m/s' }, { text: '6 m/s' }],
    explanation:
      'Let total distance be D. Time for first half = D/6. For the second half, distance = 4.5t + 7.5t = 12t = D/2 ⟹ t = D/24, so that half takes 2t = D/12. Total time = D/6 + D/12 = D/4. Average speed = D ÷ (D/4) = 4 m/s.',
  },
  {
    text: 'The slope of a velocity–time graph represents:',
    difficulty: 'easy',
    options: [{ text: 'Displacement' }, { text: 'Acceleration', correct: true }, { text: 'Speed' }, { text: 'Distance' }],
    explanation: 'dv/dt = acceleration, by definition.',
  },
  {
    text: 'A stone is dropped from a height of 20 m (g = 10 m/s²). Time taken to reach the ground?',
    difficulty: 'medium',
    options: [{ text: '1 s' }, { text: '2 s', correct: true }, { text: '3 s' }, { text: '4 s' }],
    explanation: 'h = ½gt² ⟹ 20 = 5t² ⟹ t² = 4 ⟹ t = 2 s.',
  },
  {
    text: 'A car moving at 20 m/s is brought to rest by uniform braking in 5 s. What is the magnitude of its retardation?',
    difficulty: 'medium',
    options: [{ text: '2 m/s²' }, { text: '4 m/s²', correct: true }, { text: '5 m/s²' }, { text: '10 m/s²' }],
    explanation: 'a = (v − u)/t = (0 − 20)/5 = −4 m/s², magnitude 4 m/s².',
  },
  {
    text: 'A particle\'s position is given by x = 2t² + 3t + 1 (SI units). What is its velocity at t = 2 s?',
    difficulty: 'medium',
    options: [{ text: '7 m/s' }, { text: '9 m/s' }, { text: '11 m/s', correct: true }, { text: '13 m/s' }],
    explanation: 'v = dx/dt = 4t + 3. At t = 2 s: v = 8 + 3 = 11 m/s.',
  },
  {
    text: 'For the particle with x = 2t² + 3t + 1 (SI units), its acceleration is:',
    difficulty: 'easy',
    options: [{ text: '2 m/s²' }, { text: '3 m/s²' }, { text: '4 m/s²', correct: true }, { text: '6 m/s²' }],
    explanation: 'a = d²x/dt² = 4 m/s², constant.',
  },
  {
    text: 'A particle travels 10 m from point A to point B along a straight line, then returns to A. What is its net displacement for the whole journey?',
    difficulty: 'easy',
    options: [{ text: '0', correct: true }, { text: '10 m' }, { text: '20 m' }, { text: '5 m' }],
    explanation: 'Displacement depends only on start and end points — it starts and ends at A, so displacement = 0 (distance covered is 20 m).',
  },
];

const ADVANCED_SINGLE = [
  {
    text: 'A particle starts from rest and moves with constant acceleration. The ratio of distances covered by it in the 1st, 2nd and 3rd successive equal time intervals is:',
    difficulty: 'medium',
    options: [{ text: '1 : 2 : 3' }, { text: '1 : 3 : 5', correct: true }, { text: '1 : 4 : 9' }, { text: '2 : 4 : 6' }],
    explanation: 'Distance in the nth interval ∝ (2n − 1), giving the classic odd-number ratio 1 : 3 : 5 : …',
  },
  {
    text: 'A particle moves along the positive x-axis with velocity v = k√x, where k is a constant. Its acceleration as a function of x is:',
    difficulty: 'hard',
    options: [
      { text: 'k²/2 (constant)', correct: true },
      { text: 'k²x' },
      { text: 'k²/(2x)' },
      { text: '2k²√x' },
    ],
    explanation: 'a = v(dv/dx). dv/dx = k/(2√x), so a = k√x · k/(2√x) = k²/2 — independent of x.',
  },
  {
    text: 'The displacement–time graph of a particle moving along a straight line is concave upward throughout. This means the particle\'s velocity is:',
    difficulty: 'medium',
    options: [{ text: 'Constant' }, { text: 'Increasing', correct: true }, { text: 'Decreasing' }, { text: 'Zero' }],
    explanation: 'Concave upward means the slope of the x–t graph (which is velocity) is itself increasing.',
  },
  {
    text: 'A particle\'s position is x = t³ − 6t² + 9t (SI units, t ≥ 0). At how many instants for t > 0 is the particle momentarily at rest?',
    difficulty: 'hard',
    options: [{ text: '0' }, { text: '1' }, { text: '2', correct: true }, { text: '3' }],
    explanation: 'v = dx/dt = 3t² − 12t + 9 = 3(t − 1)(t − 3), which is zero at t = 1 s and t = 3 s — two instants.',
  },
  {
    text: 'For the particle with x = t³ − 6t² + 9t, its acceleration at t = 1 s is:',
    difficulty: 'medium',
    options: [{ text: '−6 m/s²', correct: true }, { text: '−3 m/s²' }, { text: '0' }, { text: '6 m/s²' }],
    explanation: 'a = d²x/dt² = 6t − 12. At t = 1 s: a = 6 − 12 = −6 m/s².',
  },
  {
    text: 'A boat crosses a river of width d, where the river flows with speed u. The boat\'s velocity relative to the water is v (v > u), directed perpendicular to the bank. The time taken to cross the river is:',
    difficulty: 'medium',
    options: [{ text: 'd/v', correct: true }, { text: 'd/u' }, { text: 'd/(v + u)' }, { text: 'd/√(v² − u²)' }],
    explanation:
      'Only the component of velocity perpendicular to the bank (v, unaffected by the current) determines the crossing time: t = d/v. The current only causes downstream drift.',
  },
];

const ADVANCED_MULTI = [
  {
    text: 'A particle starts from rest and moves with constant positive acceleration. Which of the following statement(s) is/are correct?',
    difficulty: 'hard',
    options: [
      { text: 'The displacement–time graph is an upward-opening parabola.', correct: true },
      { text: 'The velocity–time graph is a straight line through the origin with positive slope.', correct: true },
      { text: 'The acceleration–time graph is a straight line parallel to the time axis.', correct: true },
      { text: 'The distance covered in successive equal time intervals is the same.' },
    ],
    explanation:
      'With u = 0: x ∝ t² (parabola), v = at (straight line through origin), a is constant (parallel to time axis). Distance per interval actually grows in the ratio 1:3:5:…, not equal.',
  },
  {
    text: 'A stone is thrown vertically upward from the ground with some initial speed. Neglecting air resistance, which of the following statement(s) is/are true?',
    difficulty: 'medium',
    options: [
      { text: 'Its acceleration is constant throughout the motion.', correct: true },
      { text: 'Its velocity is zero at the highest point.', correct: true },
      { text: 'Its speed at a given height while going up equals its speed at the same height while coming down.', correct: true },
      { text: 'The time taken to go up is greater than the time taken to come down.' },
    ],
    explanation:
      'Without air resistance, g is constant throughout, v = 0 momentarily at the top, and by energy conservation the speed at a given height is the same on the way up and down. By symmetry, time up equals time down — neither is greater.',
  },
  {
    text: 'A particle undergoes rectilinear motion with a constant, non-zero acceleration. Which of the following can be zero at some instant during a sufficiently long motion?',
    difficulty: 'hard',
    options: [
      { text: 'Its velocity', correct: true },
      { text: 'Its speed', correct: true },
      { text: 'Its acceleration' },
      { text: 'Its displacement from the starting point', correct: true },
    ],
    explanation:
      'Velocity (hence speed) can momentarily be zero (e.g. at the top of a vertical throw). Displacement can return to zero (e.g. thrown up, falls back to the launch point). Acceleration cannot be zero — it is given as a non-zero constant throughout.',
  },
  {
    text: 'For a particle moving with uniform acceleration a, initial velocity u, and velocity v after time t and displacement s, which of the following relation(s) is/are correct?',
    difficulty: 'medium',
    options: [
      { text: 'v = u + at', correct: true },
      { text: 's = ut + ½at²', correct: true },
      { text: 'v² = u² + 2as', correct: true },
      { text: 's = (u + v)t' },
    ],
    explanation: 'The standard kinematic equations are v = u + at, s = ut + ½at², v² = u² + 2as. The correct form of the fourth is s = (u + v)t/2 — the given option is missing the factor of ½.',
  },
  {
    text: 'A ball is dropped from the top of a tower and falls freely (neglect air resistance). Which of the following statement(s) is/are correct about its fall?',
    difficulty: 'medium',
    options: [
      { text: 'Its velocity increases uniformly with time.', correct: true },
      { text: 'The distance it covers in each successive second increases.', correct: true },
      { text: 'Its acceleration remains constant throughout the fall.', correct: true },
      { text: 'The distance covered is directly proportional to time.' },
    ],
    explanation: 'v = gt (uniform increase), acceleration g is constant, and since v keeps increasing, distance per second keeps increasing too. But total distance s = ½gt² is proportional to t², not t.',
  },
];

const ADVANCED_NUMERICAL = [
  {
    text: 'A particle starts from rest and moves with a constant acceleration of 4 m/s². The distance (in metres) it covers in the 3rd second of its motion is ____.',
    difficulty: 'medium',
    numericalAnswer: 10,
    explanation: 'Distance in the nth second: sₙ = u + a(2n − 1)/2. With u = 0, a = 4, n = 3: sₙ = 4(5)/2 = 10 m.',
  },
  {
    text: 'A car accelerates uniformly from 18 km/h to 36 km/h in 5 seconds. Its acceleration (in m/s²) is ____.',
    difficulty: 'easy',
    numericalAnswer: 1,
    explanation: '18 km/h = 5 m/s, 36 km/h = 10 m/s. a = (10 − 5)/5 = 1 m/s².',
  },
  {
    text: 'A stone is dropped from a cliff and hits the ground with a speed of 40 m/s. Taking g = 10 m/s², the height of the cliff (in metres) is ____.',
    difficulty: 'medium',
    numericalAnswer: 80,
    explanation: 'v² = 2gh ⟹ h = v²/(2g) = 1600/20 = 80 m.',
  },
  {
    text: 'Buses leave town A for town B (and vice versa) at a regular interval of T minutes, all moving at the same speed. A cyclist rides from A to B at 20 km/h and notices a bus overtakes him every 18 minutes, while a bus coming from the opposite direction passes him every 6 minutes. Find T (in minutes).',
    difficulty: 'hard',
    numericalAnswer: 9,
    explanation:
      'Let bus speed be v km/h and bus spacing d km. Overtaking: d = (v − 20)(18/60). Oncoming: d = (v + 20)(6/60). Equating: 18(v − 20) = 6(v + 20) ⟹ 12v = 480 ⟹ v = 40 km/h, so d = 20 × 0.3 = 6 km. T = 60d/v = 60(6)/40 = 9 minutes.',
  },
];

const buildQuestion = (source, answerType, examKey) => ({ ...source, answerType, examKey });

const ALL_QUESTIONS = [
  ...MAIN.map((q) => buildQuestion(q, 'single_correct', 'JEE Main')),
  ...ADVANCED_SINGLE.map((q) => buildQuestion(q, 'single_correct', 'JEE Advanced')),
  ...ADVANCED_MULTI.map((q) => buildQuestion(q, 'multi_correct', 'JEE Advanced')),
  ...ADVANCED_NUMERICAL.map((q) => buildQuestion(q, 'numerical', 'JEE Advanced')),
];

export const seed = async (client) => {
  const { rows: adminRows } = await client.query('SELECT id FROM admins WHERE email = $1', [
    SYSTEM_ADMIN_EMAIL,
  ]);
  const createdBy = adminRows[0]?.id;
  if (!createdBy) {
    console.warn('[Seed] System admin not found — skipping pilot question seed.');
    return;
  }

  const { rows: subjectRows } = await client.query(
    "SELECT id FROM subjects WHERE name = 'Physics'",
  );
  const { rows: classRows } = await client.query("SELECT id FROM classes WHERE name = 'Class 11'");
  const { rows: chapterRows } = await client.query(
    "SELECT id FROM chapters WHERE name = 'Motion in a Straight Line' AND subject_id = $1 AND class_id = $2",
    [subjectRows[0]?.id, classRows[0]?.id],
  );
  const { rows: examRows } = await client.query('SELECT id, name FROM exams');

  const subjectId = subjectRows[0]?.id;
  const classId = classRows[0]?.id;
  const chapterId = chapterRows[0]?.id;
  const examIdByName = Object.fromEntries(examRows.map((row) => [row.name, row.id]));

  if (!subjectId || !classId || !chapterId) {
    console.warn('[Seed] Physics / Class 11 / "Motion in a Straight Line" not found — skipping pilot question seed.');
    return;
  }

  // Idempotent: bail out entirely if this pilot has already been seeded.
  const { rows: existing } = await client.query(
    "SELECT 1 FROM questions WHERE chapter_id = $1 AND created_by = $2 LIMIT 1",
    [chapterId, createdBy],
  );
  if (existing.length > 0) {
    console.log('[Seed] Pilot kinematics questions already exist — skipping.');
    return;
  }

  const questionIds = [];

  for (const q of ALL_QUESTIONS) {
    const examId = examIdByName[q.examKey] ?? null;
    const { rows } = await client.query(
      `INSERT INTO questions
         (subject_id, class_id, chapter_id, exam_id, difficulty, answer_type,
          question_text, numerical_answer, numerical_tolerance, is_published, created_by)
       VALUES ($1, $2, $3, $4, $5::difficulty_level, $6::question_answer_type, $7, $8, $9, TRUE, $10)
       RETURNING id`,
      [
        subjectId,
        classId,
        chapterId,
        examId,
        q.difficulty,
        q.answerType,
        q.text,
        q.numericalAnswer ?? null,
        0,
        createdBy,
      ],
    );
    const questionId = rows[0].id;
    questionIds.push(questionId);

    if (q.options) {
      for (const [index, option] of q.options.entries()) {
        await client.query(
          `INSERT INTO options (question_id, option_text, is_correct, order_index)
           VALUES ($1, $2, $3, $4)`,
          [questionId, option.text, Boolean(option.correct), index],
        );
      }
    }

    await client.query(
      `INSERT INTO solutions (question_id, explanation_text) VALUES ($1, $2)`,
      [questionId, q.explanation],
    );
  }

  const mainIds = questionIds.slice(0, MAIN.length);
  const advancedIds = questionIds.slice(MAIN.length);

  const createSet = async ({ type, name, durationSeconds, examId, itemIds }) => {
    const { rows } = await client.query(
      `INSERT INTO question_sets (subject_id, class_id, chapter_id, exam_id, type, name, duration_seconds, created_by)
       VALUES ($1, $2, $3, $4, $5::question_set_type, $6, $7, $8)
       RETURNING id`,
      [subjectId, classId, chapterId, examId ?? null, type, name, durationSeconds, createdBy],
    );
    const setId = rows[0].id;
    for (const [index, questionId] of itemIds.entries()) {
      await client.query(
        `INSERT INTO question_set_items (set_id, question_id, order_index) VALUES ($1, $2, $3)`,
        [setId, questionId, index],
      );
    }
    return setId;
  };

  // 15Q practice set per exam label — 20 minutes each.
  await createSet({
    type: 'practice',
    name: 'Motion in a Straight Line — JEE Main Practice Set',
    durationSeconds: 20 * 60,
    examId: examIdByName['JEE Main'],
    itemIds: mainIds,
  });
  await createSet({
    type: 'practice',
    name: 'Motion in a Straight Line — JEE Advanced Practice Set',
    durationSeconds: 20 * 60,
    examId: examIdByName['JEE Advanced'],
    itemIds: advancedIds,
  });

  // 25Q full mock (all 15 Main + first 10 Advanced questions) — 50 minutes,
  // roughly 2 minutes/question, in line with real JEE pacing.
  await createSet({
    type: 'mock',
    name: 'Motion in a Straight Line — Full Mock',
    durationSeconds: 50 * 60,
    examId: null,
    itemIds: [...mainIds, ...advancedIds.slice(0, 10)],
  });

  console.log(`[Seed] Seeded ${questionIds.length} pilot questions and 3 question sets.`);
};
