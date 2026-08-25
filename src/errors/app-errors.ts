import { HttpException, HttpStatus } from '@nestjs/common';

export type AppErrorDef = {
  code: string;
  status: number;
  message: string;
};

export const APP_ERRORS = {
  AUTH_PASSWORD_DISABLED: {
    code: 'ERR-ARC-AUTH-01',
    status: HttpStatus.FORBIDDEN,
    message:
      'Password sign-in is turned off. Use Google, or ask an administrator for a service token.',
  },
  AUTH_INVALID_CREDENTIALS: {
    code: 'ERR-ARC-AUTH-02',
    status: HttpStatus.UNAUTHORIZED,
    message:
      'That username or password is incorrect. Try again, or sign in with Google.',
  },
  AUTH_SSO_NOT_CONFIGURED: {
    code: 'ERR-ARC-AUTH-03',
    status: HttpStatus.UNAUTHORIZED,
    message:
      'Google sign-in is not set up on the server. Ask an administrator to configure it.',
  },
  AUTH_SSO_MISSING_EMAIL: {
    code: 'ERR-ARC-AUTH-04',
    status: HttpStatus.UNAUTHORIZED,
    message:
      'Google did not share an email for this account. Try another Google account.',
  },
  AUTH_SSO_UNVERIFIED_EMAIL: {
    code: 'ERR-ARC-AUTH-05',
    status: HttpStatus.UNAUTHORIZED,
    message:
      'That Google email is not verified. Verify it with Google, then try again.',
  },
  AUTH_SSO_INVALID_TOKEN: {
    code: 'ERR-ARC-AUTH-06',
    status: HttpStatus.UNAUTHORIZED,
    message: 'Google sign-in did not complete. Close the prompt and try again.',
  },
  AUTH_SSO_UNASSIGNED: {
    code: 'ERR-ARC-AUTH-07',
    status: HttpStatus.UNAUTHORIZED,
    message:
      'No Arc Todo user is assigned to this Google account. Ask an administrator to add your email, then try again.',
  },
  AUTH_SESSION_USER_MISSING: {
    code: 'ERR-ARC-AUTH-08',
    status: HttpStatus.UNAUTHORIZED,
    message: 'Your session is no longer valid. Sign in again to continue.',
  },
  AUTH_JWT_USER_MISSING: {
    code: 'ERR-ARC-AUTH-09',
    status: HttpStatus.UNAUTHORIZED,
    message: 'Your session is no longer valid. Sign in again to continue.',
  },
  AUTH_SESSION_EXPIRED: {
    code: 'ERR-ARC-AUTH-10',
    status: HttpStatus.UNAUTHORIZED,
    message: 'Your session ended. Sign in again to continue.',
  },
  AUTH_SERVICE_ADMIN_MISSING: {
    code: 'ERR-ARC-AUTH-12',
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message:
      'Service sign-in is not ready. Ask an administrator to check ADMIN_USERNAME.',
  },

  ACL_ADMIN_REQUIRED: {
    code: 'ERR-ARC-ACL-01',
    status: HttpStatus.FORBIDDEN,
    message: 'This action is limited to administrators.',
  },
  ACL_PROJECT_DENIED: {
    code: 'ERR-ARC-ACL-02',
    status: HttpStatus.FORBIDDEN,
    message:
      'You do not have access to this project. Ask an administrator to add you.',
  },
  ACL_KNOWLEDGE_DENIED: {
    code: 'ERR-ARC-ACL-03',
    status: HttpStatus.FORBIDDEN,
    message:
      'You do not have access to this knowledge base. Ask an administrator to grant knowledge access.',
  },
  ACL_KNOWLEDGE_ENTRY_DENIED: {
    code: 'ERR-ARC-ACL-04',
    status: HttpStatus.FORBIDDEN,
    message:
      'You do not have access to this knowledge entry. Ask an administrator if you need it.',
  },
  ACL_NAME_FEEDBACK: {
    code: 'ERR-ARC-ACL-05',
    status: HttpStatus.FORBIDDEN,
    message:
      'Only the session owner or an administrator can start or close a feedback round.',
  },
  ACL_COMMENT_AUTHOR: {
    code: 'ERR-ARC-ACL-06',
    status: HttpStatus.FORBIDDEN,
    message: 'Only the person who wrote this comment can change or delete it.',
  },

  ANALYTICS_INVALID_RANGE: {
    code: 'ERR-ARC-ANALYTICS-01',
    status: HttpStatus.BAD_REQUEST,
    message:
      'That date range is not valid. Pick a From date that is on or before the To date.',
  },

  ORG_NOT_FOUND: {
    code: 'ERR-ARC-ORG-01',
    status: HttpStatus.NOT_FOUND,
    message:
      'That organization is not available. It may have been removed, or you do not have access.',
  },
  ORG_SLUG_TAKEN: {
    code: 'ERR-ARC-ORG-02',
    status: HttpStatus.CONFLICT,
    message: 'That organization slug is already in use. Choose a different one.',
  },
  ORG_USERS_NOT_FOUND: {
    code: 'ERR-ARC-ORG-03',
    status: HttpStatus.NOT_FOUND,
    message: 'One or more of those people could not be found. Refresh and try again.',
  },

  PROJ_NOT_FOUND: {
    code: 'ERR-ARC-PROJ-01',
    status: HttpStatus.NOT_FOUND,
    message:
      'That project is not available. It may have been removed, or you do not have access.',
  },
  PROJ_BULK_NOT_FOUND: {
    code: 'ERR-ARC-PROJ-02',
    status: HttpStatus.NOT_FOUND,
    message: 'One or more of those projects could not be found. Refresh and try again.',
  },
  PROJ_MISSING_FOR_TASK: {
    code: 'ERR-ARC-PROJ-03',
    status: HttpStatus.NOT_FOUND,
    message: 'This task is not linked to a project we can find. Refresh the board and try again.',
  },

  TASK_NOT_FOUND: {
    code: 'ERR-ARC-TASK-01',
    status: HttpStatus.NOT_FOUND,
    message:
      'That task is not available. It may have been removed, or you do not have access.',
  },
  TASK_INVALID_ID: {
    code: 'ERR-ARC-TASK-02',
    status: HttpStatus.BAD_REQUEST,
    message: 'That task id does not look right. Use a code like arc-1.',
  },
  TASK_SELF_PARENT: {
    code: 'ERR-ARC-TASK-03',
    status: HttpStatus.BAD_REQUEST,
    message: 'A task cannot be its own parent. Pick a different parent, or leave it empty.',
  },
  TASK_MOVE_WHILE_NESTED: {
    code: 'ERR-ARC-TASK-04',
    status: HttpStatus.BAD_REQUEST,
    message: 'Detach this subtask from its parent before moving it to another project.',
  },
  TASK_BUG_REASON_REQUIRED: {
    code: 'ERR-ARC-TASK-05',
    status: HttpStatus.BAD_REQUEST,
    message: 'Add a bug reason before marking this as a bug.',
  },
  TASK_PARENT_MISSING: {
    code: 'ERR-ARC-TASK-06',
    status: HttpStatus.BAD_REQUEST,
    message: 'That parent task is not in this project. Pick a parent from the same project.',
  },
  TASK_NESTED_SUBTASK: {
    code: 'ERR-ARC-TASK-07',
    status: HttpStatus.BAD_REQUEST,
    message: 'Subtasks cannot have their own subtasks. Attach this under the parent instead.',
  },
  TASK_COMMENT_NOT_FOUND: {
    code: 'ERR-ARC-TASK-08',
    status: HttpStatus.NOT_FOUND,
    message: 'That comment is gone. Refresh the task and try again.',
  },
  TASK_ASSIGNEE_INVALID: {
    code: 'ERR-ARC-TASK-09',
    status: HttpStatus.BAD_REQUEST,
    message:
      'That person cannot be assigned to this project. Pick a project member or an administrator, or leave it unassigned.',
  },

  META_FIELD_TYPE: {
    code: 'ERR-ARC-META-01',
    status: HttpStatus.BAD_REQUEST,
    message: 'One of the coding fields needs to be text. Check the values and try again.',
  },
  META_FIELD_LENGTH: {
    code: 'ERR-ARC-META-02',
    status: HttpStatus.BAD_REQUEST,
    message: 'One of the coding fields is too long. Shorten it and try again.',
  },
  META_URL: {
    code: 'ERR-ARC-META-03',
    status: HttpStatus.BAD_REQUEST,
    message: 'That link needs to start with http:// or https://.',
  },
  META_COMMITS_TYPE: {
    code: 'ERR-ARC-META-04',
    status: HttpStatus.BAD_REQUEST,
    message: 'Commits need to be a list of text values.',
  },
  META_COMMITS_COUNT: {
    code: 'ERR-ARC-META-05',
    status: HttpStatus.BAD_REQUEST,
    message: 'Too many commits are listed. Keep it to 20 or fewer.',
  },
  META_COMMITS_EMPTY: {
    code: 'ERR-ARC-META-06',
    status: HttpStatus.BAD_REQUEST,
    message: 'Each commit entry needs some text.',
  },
  META_COMMITS_LENGTH: {
    code: 'ERR-ARC-META-07',
    status: HttpStatus.BAD_REQUEST,
    message: 'One of the commit values is too long. Shorten it and try again.',
  },
  META_UNKNOWN_FIELD: {
    code: 'ERR-ARC-META-08',
    status: HttpStatus.BAD_REQUEST,
    message: 'That coding field is not supported. Remove it and try again.',
  },
  META_CATEGORY: {
    code: 'ERR-ARC-META-09',
    status: HttpStatus.BAD_REQUEST,
    message: 'That category is not available. Pick one of the listed options.',
  },
  META_OBJECT: {
    code: 'ERR-ARC-META-10',
    status: HttpStatus.BAD_REQUEST,
    message: 'Task details need to be a set of fields, not a list or a single value.',
  },
  META_SIZE: {
    code: 'ERR-ARC-META-11',
    status: HttpStatus.BAD_REQUEST,
    message: 'Those task details are too large. Remove some fields and try again.',
  },
  META_CODING_ONLY: {
    code: 'ERR-ARC-META-12',
    status: HttpStatus.BAD_REQUEST,
    message: 'Extra coding fields are only available on coding tasks.',
  },

  FILE_REQUIRED: {
    code: 'ERR-ARC-FILE-01',
    status: HttpStatus.BAD_REQUEST,
    message: 'Choose a file to upload.',
  },
  FILE_EMPTY: {
    code: 'ERR-ARC-FILE-02',
    status: HttpStatus.BAD_REQUEST,
    message: 'That file is empty. Choose a file that has content.',
  },
  FILE_TOO_LARGE: {
    code: 'ERR-ARC-FILE-03',
    status: HttpStatus.BAD_REQUEST,
    message: 'That file is too large. Choose a smaller file and try again.',
  },
  FILE_EVIDENCE_TYPE: {
    code: 'ERR-ARC-FILE-04',
    status: HttpStatus.BAD_REQUEST,
    message: 'QA evidence needs to be an image or a video.',
  },
  FILE_STORAGE_UNAVAILABLE: {
    code: 'ERR-ARC-FILE-05',
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message:
      'File storage is not available right now. Try again, or ask an administrator to check MinIO.',
  },
  FILE_EVIDENCE_NOT_FOUND: {
    code: 'ERR-ARC-FILE-06',
    status: HttpStatus.NOT_FOUND,
    message: 'That evidence file is gone. Refresh the task and try again.',
  },
  FILE_CHECKLIST_ID: {
    code: 'ERR-ARC-FILE-07',
    status: HttpStatus.BAD_REQUEST,
    message: 'That checklist item id is too long.',
  },
  FILE_ATTACHMENT_NOT_FOUND: {
    code: 'ERR-ARC-FILE-08',
    status: HttpStatus.NOT_FOUND,
    message: 'That attachment is gone. Refresh the knowledge entry and try again.',
  },

  KNOW_NOT_FOUND: {
    code: 'ERR-ARC-KNOW-01',
    status: HttpStatus.NOT_FOUND,
    message:
      'That knowledge entry is not available. It may have been removed, or you do not have access.',
  },
  KNOW_TASK_SCOPE: {
    code: 'ERR-ARC-KNOW-02',
    status: HttpStatus.BAD_REQUEST,
    message: 'A linked task can only be set on project knowledge.',
  },
  KNOW_TASK_PROJECT: {
    code: 'ERR-ARC-KNOW-03',
    status: HttpStatus.BAD_REQUEST,
    message: 'That task belongs to a different project than this knowledge entry.',
  },
  KNOW_RAG_NOT_CONFIGURED: {
    code: 'ERR-ARC-KNOW-04',
    status: HttpStatus.BAD_REQUEST,
    message:
      'Knowledge indexing is not set up. Ask an administrator to configure RAG.',
  },

  NAME_TITLE_REQUIRED: {
    code: 'ERR-ARC-NAME-01',
    status: HttpStatus.BAD_REQUEST,
    message: 'Enter a session name to continue.',
  },
  NAME_INVALID_GOAL: {
    code: 'ERR-ARC-NAME-02',
    status: HttpStatus.BAD_REQUEST,
    message: 'That naming goal is not available. Pick one of the listed options.',
  },
  NAME_SESSION_NOT_FOUND: {
    code: 'ERR-ARC-NAME-03',
    status: HttpStatus.NOT_FOUND,
    message:
      'That naming session is not available. It may have been removed, or you do not have access.',
  },
  NAME_REQUIRED: {
    code: 'ERR-ARC-NAME-04',
    status: HttpStatus.BAD_REQUEST,
    message: 'Enter a name to check.',
  },
  NAME_CHECK_FIRST: {
    code: 'ERR-ARC-NAME-05',
    status: HttpStatus.BAD_REQUEST,
    message: 'Check the name first, then open domain history.',
  },
  NAME_CANDIDATE_NOT_FOUND: {
    code: 'ERR-ARC-NAME-06',
    status: HttpStatus.NOT_FOUND,
    message: 'That name candidate is gone. Refresh the session and try again.',
  },
  NAME_ROUND_SIZE: {
    code: 'ERR-ARC-NAME-07',
    status: HttpStatus.BAD_REQUEST,
    message: 'Select 2 to 5 candidates for this feedback round.',
  },
  NAME_ROUND_UNKNOWN: {
    code: 'ERR-ARC-NAME-08',
    status: HttpStatus.BAD_REQUEST,
    message: 'One of those candidates is not in this session. Refresh and try again.',
  },
  NAME_ROUND_OPEN: {
    code: 'ERR-ARC-NAME-09',
    status: HttpStatus.BAD_REQUEST,
    message: 'A feedback round is already open. Close it before starting another.',
  },
  NAME_ROUND_NOT_FOUND: {
    code: 'ERR-ARC-NAME-10',
    status: HttpStatus.NOT_FOUND,
    message: 'That feedback round is gone. Refresh the session and try again.',
  },
  NAME_ROUND_CLOSED: {
    code: 'ERR-ARC-NAME-11',
    status: HttpStatus.BAD_REQUEST,
    message: 'This feedback round is already closed.',
  },
  NAME_CANDIDATE_NOT_IN_ROUND: {
    code: 'ERR-ARC-NAME-12',
    status: HttpStatus.BAD_REQUEST,
    message: 'That candidate is not part of this feedback round.',
  },

  DIAG_TITLE_REQUIRED: {
    code: 'ERR-ARC-DIAG-01',
    status: HttpStatus.BAD_REQUEST,
    message: 'Enter a diagram name to continue.',
  },
  DIAG_NOT_FOUND: {
    code: 'ERR-ARC-DIAG-02',
    status: HttpStatus.NOT_FOUND,
    message:
      'That diagram is not available. It may have been removed, or you do not have access.',
  },
  DIAG_WIREFRAME_MISSING: {
    code: 'ERR-ARC-DIAG-03',
    status: HttpStatus.BAD_REQUEST,
    message: 'That wireframe is not in this project. Open it from Wireframes instead.',
  },

  WIRE_TITLE_REQUIRED: {
    code: 'ERR-ARC-WIRE-01',
    status: HttpStatus.BAD_REQUEST,
    message: 'Enter a wireframe name to continue.',
  },
  WIRE_NOT_FOUND: {
    code: 'ERR-ARC-WIRE-02',
    status: HttpStatus.NOT_FOUND,
    message:
      'That wireframe is not available. It may have been removed, or you do not have access.',
  },
  WIRE_INVALID_HTML: {
    code: 'ERR-ARC-WIRE-03',
    status: HttpStatus.BAD_REQUEST,
    message: 'That wireframe HTML could not be saved. Check the markup and try again.',
  },

  USER_USERNAME_TAKEN: {
    code: 'ERR-ARC-USER-01',
    status: HttpStatus.CONFLICT,
    message: 'That username is already taken. Choose a different one.',
  },
  USER_PASSWORD_REQUIRED: {
    code: 'ERR-ARC-USER-02',
    status: HttpStatus.BAD_REQUEST,
    message: 'Enter a password for this user.',
  },
  USER_NOT_FOUND: {
    code: 'ERR-ARC-USER-03',
    status: HttpStatus.NOT_FOUND,
    message: 'That user is gone. Refresh the list and try again.',
  },
  USER_SELF_ADMIN: {
    code: 'ERR-ARC-USER-04',
    status: HttpStatus.BAD_REQUEST,
    message: 'You cannot remove your own administrator access.',
  },
  USER_SELF_DELETE: {
    code: 'ERR-ARC-USER-05',
    status: HttpStatus.BAD_REQUEST,
    message: 'You cannot delete your own account.',
  },
  USER_SSO_TAKEN: {
    code: 'ERR-ARC-USER-06',
    status: HttpStatus.CONFLICT,
    message: 'That Google email is already assigned to another user.',
  },

  PERS_NOT_FOUND: {
    code: 'ERR-ARC-PERS-01',
    status: HttpStatus.NOT_FOUND,
    message:
      'That person is not available. They may have been removed, or you do not have access.',
  },

  CHAT_CONVERSATION_NOT_FOUND: {
    code: 'ERR-ARC-CHAT-07',
    status: HttpStatus.NOT_FOUND,
    message: 'That conversation is gone. Start a new chat and try again.',
  },
  CHAT_ORG_REQUIRED: {
    code: 'ERR-ARC-CHAT-08',
    status: HttpStatus.BAD_REQUEST,
    message: 'Choose an organization before choosing a project for this chat.',
  },
  CHAT_API_KEY_MISSING: {
    code: 'ERR-ARC-CHAT-09',
    status: HttpStatus.NOT_FOUND,
    message:
      'The chatbot API key is not set. Add it in Settings before testing the chatbot.',
  },
  CHAT_SETTINGS_NOT_FOUND: {
    code: 'ERR-ARC-CHAT-10',
    status: HttpStatus.NOT_FOUND,
    message: 'Chatbot settings are not available. Refresh Settings and try again.',
  },

  RAG_SETTINGS_NOT_FOUND: {
    code: 'ERR-ARC-RAG-01',
    status: HttpStatus.NOT_FOUND,
    message: 'RAG settings are not available. Refresh Settings and try again.',
  },
  RAG_NOT_CONFIGURED: {
    code: 'ERR-ARC-RAG-02',
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message:
      'Knowledge search is not set up. Ask an administrator to configure the RAG service.',
  },
  RAG_UNAVAILABLE: {
    code: 'ERR-ARC-RAG-03',
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message:
      'Knowledge search is unavailable right now. Try again in a moment.',
  },
  RAG_UPSTREAM: {
    code: 'ERR-ARC-RAG-04',
    status: HttpStatus.BAD_GATEWAY,
    message:
      'Knowledge search could not complete this request. Try again in a moment.',
  },

  MCP_TOOL_NOT_FOUND: {
    code: 'ERR-ARC-MCP-01',
    status: HttpStatus.NOT_FOUND,
    message: 'That MCP tool is not in the catalog. Refresh Settings and try again.',
  },

  PUSH_NOT_CONFIGURED: {
    code: 'ERR-ARC-PUSH-01',
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message:
      'Browser notifications are not set up. Ask an administrator to configure Web Push.',
  },

  VAL_REQUEST: {
    code: 'ERR-ARC-VAL-01',
    status: HttpStatus.BAD_REQUEST,
    message: 'Some fields need a closer look. Check what you entered and try again.',
  },

  SYS_UNEXPECTED: {
    code: 'ERR-ARC-SYS-01',
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message:
      'Something went wrong on our side. Try again, or ask an administrator if it keeps happening.',
  },
  SYS_NOT_FOUND: {
    code: 'ERR-ARC-SYS-02',
    status: HttpStatus.NOT_FOUND,
    message:
      'That item is not available. It may have been removed, or you do not have access.',
  },
  SYS_CONFLICT: {
    code: 'ERR-ARC-SYS-03',
    status: HttpStatus.CONFLICT,
    message: 'That change conflicts with something already saved. Refresh and try again.',
  },
  SYS_UNAVAILABLE: {
    code: 'ERR-ARC-SYS-04',
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'This service is unavailable right now. Try again in a moment.',
  },
} as const satisfies Record<string, AppErrorDef>;

export type AppErrorKey = keyof typeof APP_ERRORS;

export class AppHttpException extends HttpException {
  readonly appCode: string;

  constructor(def: AppErrorDef, message = def.message) {
    super(
      {
        statusCode: def.status,
        code: def.code,
        message,
      },
      def.status,
    );
    this.appCode = def.code;
  }
}

export function appError(key: AppErrorKey, message?: string): AppHttpException {
  const def = APP_ERRORS[key];
  return new AppHttpException(def, message ?? def.message);
}

export function isAppErrorPayload(
  value: unknown,
): value is { statusCode: number; code: string; message: string } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const payload = value as { code?: unknown; message?: unknown; statusCode?: unknown };
  return (
    typeof payload.code === 'string' &&
    typeof payload.message === 'string' &&
    typeof payload.statusCode === 'number'
  );
}
