export type Point = { y: string; v: number };

export type Category = 'folkeskole' | 'friskole' | 'international-public' | 'international-private';

export interface Indicators {
  grade: number | null;
  valueAdded: number | null;
  wellbeing: number | null;
  wellbeingTop: number | null;
  absence: number | null;
  classSize: number | null;
  qualifiedTeaching: number | null;
  toEducation: number | null;
  gradeTrend: number | null;
  pupilTrend: number | null;
  retention: number | null;
  /** Social-climate index: avg. points better (+) / worse (−) than Denmark. */
  climate: number | null;
  /** % of pupils from outside the municipality (3-year mean). */
  fromOutside: number | null;
}

export interface ClimateItem {
  key: string;
  label: string;
  band: string;
  polarity: 'good' | 'bad';
  question: string;
  year: string;
  value: number;
  municipality: number | null;
  national: number | null;
  n: number;
  reliable: boolean;
  trend: Point[];
}

export interface ExamResult {
  exam: string;
  year: number;
  metric: string;
  value: number;
  benchmark: number | null;
  benchmarkLabel: string | null;
  candidates: number | null;
  sourceUrl: string | null;
}

export interface School {
  id: string;
  campuses: { id: string; name: string; address: string; lat: number | null; lng: number | null }[];
  topGrade: number | null;
  isNew: boolean;
  founded: number | null;
  /** Outcomes from non-Ministry sources (school sites, exam bodies). */
  external: {
    exams: ExamResult[];
    wellbeing: { survey: string; year: number; metric: string; value: number; sourceUrl: string | null }[];
    inspection: { year: number | null; conclusion: string; concerns: string | null; sourceUrl: string | null }[];
    context: Record<string, string | number | null>;
    notes: string | null;
    gradeEstimate: { value: number; basis: string } | null;
  } | null;
  name: string;
  parentId: string | null;
  category: Category;
  isPrivate: boolean;
  isInternational: boolean;
  tenthGradeOnly: boolean;
  special: boolean;
  municipality: string;
  address: string;
  postalCode: string;
  city: string;
  lat: number | null;
  lng: number | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  principal: string | null;
  languages: string[];
  curriculum: string;
  pedagogy: string | null;
  profile: string | null;
  gradesOffered: string | null;
  waitlist: string | null;
  fees: {
    monthly: number | null;
    monthsPerYear: number | null;
    annual: number | null;
    sfoMonthly: number | null;
    sfoMonthsPerYear: number | null;
    enrollment: number | null;
    siblingDiscount: string | null;
    year: string | null;
    notes: string | null;
    source: string | null;
  };
  international: {
    type?: string;
    curriculum?: string;
    danishOffering?: string | null;
    accreditation?: string | null;
    highlights?: string[] | null;
    considerations?: string[] | null;
    admission?: string | null;
    sourceUrls?: string[] | null;
  } | null;
  latest: {
    pupils: number | null;
    pupilsYear: string | null;
    classSize: number | null;
    absence: number | null;
    absenceYear: string | null;
    grade: number | null;
    gradeYear: string | null;
    danish: number | null;
    math: number | null;
    socrefDiff: number | null;
    socrefExpected: number | null;
    socrefSignificant: string | null;
    socrefYear: string | null;
    wellbeingTop: number | null;
    wellbeingGeneral: number | null;
    qualifiedTeaching: number | null;
    toEducation: number | null;
    pupilsPerTeacher: number | null;
    inclusion: number | null;
    shareMin2: number | null;
    pupilsByGrade: Record<string, number> | null;
  };
  indicators: Indicators;
  series: {
    grade: Point[];
    danish: Point[];
    math: Point[];
    socrefDiff: Point[];
    socrefExpected: Point[];
    pupils: Point[];
    classSize: Point[];
    absence: Point[];
    wellbeingTop: Point[];
    wellbeing: Partial<Record<'general' | 'social' | 'academic' | 'support' | 'calm', Point[]>>;
    qualifiedTeaching: Point[];
    pupilsPerTeacher: Point[];
  };
  climate: ClimateItem[] | null;
  /** % of pupils living outside the school's municipality, per year. */
  fromOutside: Point[];
  /** Net % change of year groups into the next school year. */
  cohortFlow: Point[];
  qualifiedBySubject: { year: string; rows: { subject: string; stage: string; value: number; municipality: number | null; national: number | null }[] } | null;
  news: { title: string; url: string; date: string | null; source: string | null }[];
  hasData: boolean;
}

export type Benchmark = Partial<Record<'grade' | 'absence' | 'classSize' | 'wellbeingTop' | 'qualifiedTeaching' | 'toEducation', number>>;

export interface Dataset {
  generatedAt: string;
  statsFetchedAt: string | null;
  sources: Record<string, string>;
  municipalities: string[];
  benchmarks: Record<string, Record<string, Benchmark>>;
  municipalSfo: Record<string, { sfoMonthlyDKK: number | null; monthsPerYear: number | null; year: string; sourceUrl: string }>;
  schools: School[];
}
