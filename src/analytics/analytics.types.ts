import { TaskStatus } from '../tasks/task.enums';
import {
  ANALYTICS_COMPLETION_TIMESTAMP_SOURCE,
  ANALYTICS_TEST_DURATION_SOURCE,
} from './analytics-summary.util';
import type { GrowthMetric } from './analytics-period.util';
import type { AnalyticsPeriodKey } from './analytics-period.util';

export type AnalyticsByStatus = Record<TaskStatus, number>;

export interface AnalyticsPersonRow {
  userId: string | null;
  username: string;
  tasksCreated: number;
  tasksCompleted: number;
  moves: number;
  openBugs: number;
  averageMsToDone: number | null;
  sampleSizeToDone: number;
  averageMsInTest: number | null;
  sampleSizeTestDwells: number;
}

export interface AnalyticsPeriodInfo {
  key: AnalyticsPeriodKey;
  label: string;
  from: string | null;
  to: string | null;
  previousLabel: string | null;
  compareFrom: string | null;
  compareTo: string | null;
}

export interface AnalyticsDwellStat {
  averageMs: number | null;
  sampleSize: number;
}

export type AnalyticsDwellByStatus = Record<TaskStatus, AnalyticsDwellStat>;

export interface AnalyticsLongestStay {
  status: TaskStatus;
  label: string;
  averageMs: number;
  sampleSize: number;
}

export type AnalyticsTrendGranularity = 'day' | 'week';

export interface AnalyticsTrendBucket {
  date: string;
  tasksCreated: number;
  tasksCompleted: number;
  moves: number;
  bugReports: number;
}

export interface AnalyticsTrend {
  granularity: AnalyticsTrendGranularity;
  buckets: AnalyticsTrendBucket[];
}

export interface AnalyticsSummary {
  period: AnalyticsPeriodInfo;
  growth: {
    tasksCreated: GrowthMetric;
    tasksCompleted: GrowthMetric;
    moves: GrowthMetric;
    bugReports: GrowthMetric;
  };
  tasksCreated: number;
  tasksCompleted: number;
  activeCount: number;
  archivedCount: number;
  byStatus: AnalyticsByStatus;
  openBugs: number;
  bugReports: number;
  moves: number;
  averageMsToDone: number | null;
  sampleSize: number;
  completionTimestampSource: typeof ANALYTICS_COMPLETION_TIMESTAMP_SOURCE;
  averageMsToSolveBug: number | null;
  sampleSizeBugSolves: number;
  averageMsInDevTest: number | null;
  sampleSizeDevTestDwells: number;
  averageMsInQaTest: number | null;
  sampleSizeQaTestDwells: number;
  testDurationSource: typeof ANALYTICS_TEST_DURATION_SOURCE;
  dwellByStatus: AnalyticsDwellByStatus;
  longestStay: AnalyticsLongestStay | null;
  checklistTasks: number;
  checklistItemsTotal: number;
  checklistItemsChecked: number;
  checklistCompleteTasks: number;
  checklistOpenBugs: number;
  byPerson: AnalyticsPersonRow[];
  trend: AnalyticsTrend;
}

export interface AnalyticsBugFlagDossier {
  id: string;
  taskId: string;
  displayId: string;
  title: string;
  primary: string;
  secondary: string[];
  motivo: string;
  evidence: string | null;
  createdAt: string;
  createdById: string | null;
}
