import { TaskStatus } from '../tasks/task.enums';
import {
  ANALYTICS_COMPLETION_TIMESTAMP_SOURCE,
  ANALYTICS_TEST_DURATION_SOURCE,
} from './analytics-summary.util';

export type AnalyticsByStatus = Record<TaskStatus, number>;

export interface AnalyticsPersonRow {
  userId: string | null;
  username: string;
  tasksCreated: number;
  moves: number;
  openBugs: number;
  averageMsToDone: number | null;
  sampleSizeToDone: number;
  averageMsInTest: number | null;
  sampleSizeTestDwells: number;
}

export interface AnalyticsSummary {
  tasksCreated: number;
  tasksCreatedLast7Days: number;
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
  checklistTasks: number;
  checklistItemsTotal: number;
  checklistItemsChecked: number;
  checklistCompleteTasks: number;
  checklistOpenBugs: number;
  byPerson: AnalyticsPersonRow[];
}
