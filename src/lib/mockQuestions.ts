export interface MockQuestion {
  id: string;
  subtopicId: string;
  subtopicName: string;
  topicName: string;
  externalId: string;
  questionText: string;
  questionType: 'mcq' | 'tita';
  options?: { a: string; b: string; c: string; d: string };
  correctAnswer: string;
  solution: string;
  difficulty: number;
  expectedTimeSeconds: number;
  // Replica stand-ins (Doc 5 §7): hand-authored look-alikes of a parent question,
  // treated as pre-verified. The Gemini pipeline later slots in behind the same flag.
  isReplica?: boolean;
  parentQuestionId?: string;
}

export const MOCK_QUESTIONS: MockQuestion[] = [
  {
    id: 'q1',
    subtopicId: 'sub-pl',
    subtopicName: 'Profit & Loss',
    topicName: 'Arithmetic',
    externalId: 'CAT_MOCK_QA_01',
    questionText:
      'A shopkeeper marks an item 40% above its cost price and then offers a 25% discount on the marked price. What is his profit or loss percentage?',
    questionType: 'mcq',
    options: { a: '5% profit', b: '10% profit', c: '5% loss', d: '10% loss' },
    correctAnswer: 'a',
    solution:
      'Let CP = 100. Marked price = 140. After 25% discount: 140 × 0.75 = 105. Profit = 105 − 100 = 5, so profit = 5%.',
    difficulty: 4,
    expectedTimeSeconds: 90,
  },
  {
    id: 'q2',
    subtopicId: 'sub-tsd',
    subtopicName: 'Relative Speed',
    topicName: 'Arithmetic',
    externalId: 'CAT_MOCK_QA_02',
    questionText:
      'Two trains, each 150 m long, run on parallel tracks in opposite directions, each at 45 km/h. How long do they take to cross each other?',
    questionType: 'mcq',
    options: { a: '8 seconds', b: '10 seconds', c: '12 seconds', d: '15 seconds' },
    correctAnswer: 'c',
    solution:
      'Relative speed = 45 + 45 = 90 km/h = 25 m/s. Total distance = 150 + 150 = 300 m. Time = 300 / 25 = 12 seconds.',
    difficulty: 5,
    expectedTimeSeconds: 100,
  },
  {
    id: 'q3',
    subtopicId: 'sub-work',
    subtopicName: 'Multiple Workers',
    topicName: 'Arithmetic',
    externalId: 'CAT_MOCK_QA_03',
    questionText:
      'A can complete a job in 12 days and B can complete it in 18 days. They work together for 4 days, after which A leaves. In how many more days will B finish the remaining work? (Enter a number)',
    questionType: 'tita',
    correctAnswer: '8',
    solution:
      'A\'s rate = 1/12, B\'s rate = 1/18. Combined rate for 4 days = 4×(1/12+1/18) = 4×(5/36) = 20/36 = 5/9. Remaining = 4/9. B alone takes (4/9)/(1/18) = 8 days.',
    difficulty: 6,
    expectedTimeSeconds: 120,
  },
  {
    id: 'q4',
    subtopicId: 'sub-quad',
    subtopicName: 'Roots',
    topicName: 'Algebra',
    externalId: 'CAT_MOCK_QA_04',
    questionText:
      'If the roots of x² − 7x + k = 0 are in the ratio 2:5, what is the value of k?',
    questionType: 'mcq',
    options: { a: '8', b: '10', c: '12', d: '14' },
    correctAnswer: 'b',
    solution:
      'Let roots be 2a and 5a. Sum = 7a = 7 → a = 1. Roots = 2, 5. Product = k = 10.',
    difficulty: 6,
    expectedTimeSeconds: 110,
  },
  {
    id: 'q5',
    subtopicId: 'sub-ratio',
    subtopicName: 'Basic Ratio',
    topicName: 'Arithmetic',
    externalId: 'CAT_MOCK_QA_05',
    questionText:
      'The ratio of the ages of A and B, 5 years ago, was 3:4. Their present age ratio is 4:5. What is the present age of A?',
    questionType: 'mcq',
    options: { a: '20 years', b: '25 years', c: '30 years', d: '35 years' },
    correctAnswer: 'a',
    solution:
      'Let ages 5 years ago be 3k, 4k. Present ages: 3k+5, 4k+5. Given (3k+5)/(4k+5) = 4/5: 15k+25 = 16k+20 → k = 5. Present age of A = 3(5)+5 = 20.',
    difficulty: 5,
    expectedTimeSeconds: 100,
  },
  {
    id: 'q6',
    subtopicId: 'sub-tri',
    subtopicName: 'Basic Properties',
    topicName: 'Geometry',
    externalId: 'CAT_MOCK_QA_06',
    questionText:
      'In a right triangle, the two legs are 9 cm and 12 cm. What is the length of the altitude drawn to the hypotenuse?',
    questionType: 'mcq',
    options: { a: '6.4 cm', b: '7.2 cm', c: '8.0 cm', d: '9.6 cm' },
    correctAnswer: 'b',
    solution:
      'Hypotenuse = √(9²+12²) = 15. Area = (1/2)×9×12 = 54. Altitude = 2×Area/hypotenuse = 108/15 = 7.2 cm.',
    difficulty: 5,
    expectedTimeSeconds: 100,
  },
  {
    id: 'q7',
    subtopicId: 'sub-ci',
    subtopicName: 'Annual CI',
    topicName: 'Arithmetic',
    externalId: 'CAT_MOCK_QA_07',
    questionText:
      'A sum of ₹8,000 amounts to ₹9,261 in 3 years at compound interest, compounded annually. What is the rate of interest?',
    questionType: 'mcq',
    options: { a: '4%', b: '5%', c: '6%', d: '7%' },
    correctAnswer: 'b',
    solution:
      '9261/8000 = (1+r)³. 9261 = 21³, 8000 = 20³. So (1+r) = 21/20 → r = 5%.',
    difficulty: 4,
    expectedTimeSeconds: 90,
  },
  {
    id: 'q8',
    subtopicId: 'sub-numsys',
    subtopicName: 'Divisibility',
    topicName: 'Number System',
    externalId: 'CAT_MOCK_QA_08',
    questionText:
      'What is the remainder when 7^100 is divided by 100? (Enter a number)',
    questionType: 'tita',
    correctAnswer: '1',
    solution:
      'By Euler\'s theorem, φ(100) = 40, and gcd(7,100)=1, so 7^40 ≡ 1 (mod 100). 100 = 2×40 + 20, so 7^100 ≡ 7^20 (mod 100). Computing 7^20 mod 100 cycles down to 1 for this specific case (pattern of 7^n mod 100 repeats every 4: 7,49,43,1). 20 mod 4 = 0 → remainder is 1.',
    difficulty: 7,
    expectedTimeSeconds: 140,
  },
  {
    id: 'q9',
    subtopicId: 'sub-avg',
    subtopicName: 'Averages',
    topicName: 'Arithmetic',
    externalId: 'CAT_MOCK_QA_09',
    questionText:
      'The average weight of 8 people increases by 2.5 kg when a new person replaces one of them weighing 65 kg. What is the weight of the new person?',
    questionType: 'mcq',
    options: { a: '80 kg', b: '82 kg', c: '85 kg', d: '90 kg' },
    correctAnswer: 'c',
    solution:
      'Total weight increase = 8 × 2.5 = 20 kg. New person\'s weight = 65 + 20 = 85 kg.',
    difficulty: 3,
    expectedTimeSeconds: 70,
  },
  {
    id: 'q10',
    subtopicId: 'sub-pnc',
    subtopicName: 'Permutations',
    topicName: 'Modern Mathematics',
    externalId: 'CAT_MOCK_QA_10',
    questionText:
      'In how many ways can the letters of the word "MOBILE" be arranged so that the vowels always come together?',
    questionType: 'mcq',
    options: { a: '144', b: '288', c: '360', d: '720' },
    correctAnswer: 'a',
    solution:
      'Vowels O, I, E treated as one unit: (M, B, L, [OIE]) = 4 units → 4! = 24 arrangements. Vowels internally arrange in 3! = 6 ways. Total = 24 × 6 = 144.',
    difficulty: 5,
    expectedTimeSeconds: 100,
  },
];

// ============================================================
// REPLICA QUESTIONS — hand-authored variants of parent questions, standing in
// for the Gemini generation + verification pipeline (Doc 5 §7). The engine
// treats them as status='verified'; the generator later drops in behind the
// same isReplica flag with zero changes to consuming code.
// ============================================================

export const REPLICA_QUESTIONS: MockQuestion[] = [
  {
    id: 'r1-q1',
    subtopicId: 'sub-pl',
    subtopicName: 'Profit & Loss',
    topicName: 'Arithmetic',
    externalId: 'REPLICA_PL_01',
    isReplica: true,
    parentQuestionId: 'q1',
    questionText:
      'A trader marks an item 50% above its cost price and then offers a 20% discount on the marked price. What is his profit percentage?',
    questionType: 'mcq',
    options: { a: '10%', b: '15%', c: '20%', d: '25%' },
    correctAnswer: 'c',
    solution: 'Let CP = 100. Marked = 150. After 20% discount: 150 × 0.8 = 120. Profit = 20%.',
    difficulty: 4,
    expectedTimeSeconds: 90,
  },
  {
    id: 'r1-q2',
    subtopicId: 'sub-tsd',
    subtopicName: 'Relative Speed',
    topicName: 'Arithmetic',
    externalId: 'REPLICA_TSD_01',
    isReplica: true,
    parentQuestionId: 'q2',
    questionText:
      'Two trains, each 200 m long, run on parallel tracks in opposite directions, each at 36 km/h. How long do they take to cross each other?',
    questionType: 'mcq',
    options: { a: '15 seconds', b: '18 seconds', c: '20 seconds', d: '24 seconds' },
    correctAnswer: 'c',
    solution: 'Relative speed = 36 + 36 = 72 km/h = 20 m/s. Distance = 200 + 200 = 400 m. Time = 400 / 20 = 20 s.',
    difficulty: 5,
    expectedTimeSeconds: 100,
  },
  {
    id: 'r1-q3',
    subtopicId: 'sub-work',
    subtopicName: 'Multiple Workers',
    topicName: 'Arithmetic',
    externalId: 'REPLICA_TW_01',
    isReplica: true,
    parentQuestionId: 'q3',
    questionText:
      'A can complete a job in 10 days and B in 15 days. They work together for 4 days, after which A leaves. In how many more days will B finish the remaining work? (Enter a number)',
    questionType: 'tita',
    correctAnswer: '5',
    solution:
      'Combined rate = 1/10 + 1/15 = 1/6. In 4 days: 4/6 = 2/3 done. Remaining 1/3. B alone: (1/3)/(1/15) = 5 days.',
    difficulty: 6,
    expectedTimeSeconds: 120,
  },
  {
    id: 'r1-q4',
    subtopicId: 'sub-quad',
    subtopicName: 'Roots',
    topicName: 'Algebra',
    externalId: 'REPLICA_QUAD_01',
    isReplica: true,
    parentQuestionId: 'q4',
    questionText: 'If the roots of x² − 9x + k = 0 are in the ratio 1:2, what is the value of k?',
    questionType: 'mcq',
    options: { a: '12', b: '14', c: '18', d: '20' },
    correctAnswer: 'c',
    solution: 'Roots a, 2a. Sum = 3a = 9 → a = 3. Roots 3, 6. Product k = 18.',
    difficulty: 6,
    expectedTimeSeconds: 110,
  },
  {
    id: 'r1-q5',
    subtopicId: 'sub-ratio',
    subtopicName: 'Basic Ratio',
    topicName: 'Arithmetic',
    externalId: 'REPLICA_RATIO_01',
    isReplica: true,
    parentQuestionId: 'q5',
    questionText:
      'The ratio of the ages of A and B, 4 years ago, was 5:7. Their present age ratio is 3:4. What is the present age of A?',
    questionType: 'mcq',
    options: { a: '20 years', b: '24 years', c: '28 years', d: '32 years' },
    correctAnswer: 'b',
    solution:
      'Ages 4 years ago: 5k, 7k. Present: 5k+4, 7k+4. (5k+4)/(7k+4) = 3/4 → 20k+16 = 21k+12 → k = 4. A = 5(4)+4 = 24.',
    difficulty: 5,
    expectedTimeSeconds: 100,
  },
  {
    id: 'r1-q6',
    subtopicId: 'sub-tri',
    subtopicName: 'Basic Properties',
    topicName: 'Geometry',
    externalId: 'REPLICA_TRI_01',
    isReplica: true,
    parentQuestionId: 'q6',
    questionText:
      'In a right triangle, the two legs are 6 cm and 8 cm. What is the length of the altitude drawn to the hypotenuse?',
    questionType: 'mcq',
    options: { a: '4.2 cm', b: '4.8 cm', c: '5.0 cm', d: '5.6 cm' },
    correctAnswer: 'b',
    solution: 'Hypotenuse = √(36+64) = 10. Area = (1/2)(6)(8) = 24. Altitude = 2×24/10 = 4.8 cm.',
    difficulty: 5,
    expectedTimeSeconds: 100,
  },
];

// The full servable pool: originals + verified replicas.
export const ALL_QUESTIONS: MockQuestion[] = [...MOCK_QUESTIONS, ...REPLICA_QUESTIONS];

export const TOPIC_NAMES = Array.from(new Set(MOCK_QUESTIONS.map((q) => q.topicName)));

// Per-subtopic weighting mirroring the seeded taxonomy (frequency_weight) and
// per-topic weighting (topics.topic_weight from CAT_Topic_Weights). The weakness
// formula reads these; when Supabase lands they come from the subtopics/topics tables.
export interface SubtopicMeta {
  frequencyWeight: number; // 0.4 low · 0.7 medium · 1.0 high · 1.3 very high
  topicWeight: number; // Arithmetic 1.0 · Algebra 0.95 · Geometry 0.7 · Modern 0.45 · Number System 0.4
}

export const SUBTOPIC_META: Record<string, SubtopicMeta> = {
  'sub-pl': { frequencyWeight: 1.3, topicWeight: 1.0 },
  'sub-tsd': { frequencyWeight: 1.3, topicWeight: 1.0 },
  'sub-work': { frequencyWeight: 1.3, topicWeight: 1.0 },
  'sub-quad': { frequencyWeight: 1.3, topicWeight: 0.95 },
  'sub-ratio': { frequencyWeight: 1.3, topicWeight: 1.0 },
  'sub-tri': { frequencyWeight: 1.3, topicWeight: 0.7 },
  'sub-ci': { frequencyWeight: 1.0, topicWeight: 1.0 },
  'sub-numsys': { frequencyWeight: 0.7, topicWeight: 0.4 },
  'sub-avg': { frequencyWeight: 1.0, topicWeight: 1.0 },
  'sub-pnc': { frequencyWeight: 1.0, topicWeight: 0.45 },
};
