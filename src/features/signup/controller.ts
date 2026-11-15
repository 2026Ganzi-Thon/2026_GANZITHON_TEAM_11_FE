import { ApiError } from '../../api/errors';
import type { LoginRequest } from '../../api/contracts';
import {
  birthDateError,
  formatDate,
  parseDate,
  withDatePart,
  type DateParts,
} from '../birthDate/date';
import { validBirthDateResult, type BirthDateResult } from '../birthDate/types';
import {
  consentIds,
  type Choices,
  type ConsentDocuments,
  type ConsentId,
  type Registration,
  type SignupActions,
} from './types';
export type SignupStage =
  'welcome' | 'email' | 'login' | 'consents' | 'birth' | 'complete';
const unchecked = (): Choices => ({
  terms: false,
  privacy: false,
  processing: false,
  notifications: false,
});
export interface SignupState {
  stage: SignupStage;
  email: string;
  password: string;
  confirmation: string;
  fields: Partial<Record<'email' | 'password' | 'confirmation', string>>;
  date: DateParts;
  choices: Choices;
  documents: ConsentDocuments | null;
  documentLoading: boolean;
  documentError: boolean;
  busy: boolean;
  error: string;
  registration: Registration | null;
  result: BirthDateResult | null;
  uncertain: boolean;
  birthUncertain: boolean;
}
function validDocuments(d: ConsentDocuments) {
  return (
    !!d &&
    typeof d.revision === 'string' &&
    !!d.revision.trim() &&
    Array.isArray(d.documents) &&
    d.documents.length === 4 &&
    consentIds.every(
      (id) =>
        d.documents.filter(
          (doc) =>
            doc.id === id &&
            [doc.title, doc.body, doc.version].every(
              (v) => typeof v === 'string' && !!v.trim(),
            ),
        ).length === 1,
    )
  );
}
export function createSignupController(actions: SignupActions) {
  let state: SignupState = {
    stage: 'welcome',
    email: '',
    password: '',
    confirmation: '',
    fields: {},
    date: parseDate(
      actions.today < '2004-05-14' ? actions.today : '2004-05-14',
    ) ?? { year: 2004, month: 5, day: 14 },
    choices: unchecked(),
    documents: null,
    documentLoading: false,
    documentError: false,
    busy: false,
    error: '',
    registration: null,
    result: null,
    uncertain: false,
    birthUncertain: false,
  };
  let active: AbortController | null = null,
    stopped = false;
  let birthWork: string | null = null;
  let registrationWork: { key: string; credentials: LoginRequest } | null =
    null;
  const listeners = new Set<() => void>();
  const patch = (value: Partial<SignupState>) => {
    state = { ...state, ...value };
    listeners.forEach((l) => l());
  };
  const current = (c: AbortController) =>
    !stopped && active === c && !c.signal.aborted;
  async function reload() {
    if (stopped || active || state.stage !== 'consents') return;
    const c = new AbortController();
    active = c;
    patch({
      documentLoading: true,
      documentError: false,
      documents: null,
      choices: unchecked(),
    });
    try {
      const docs = await actions.loadDocuments(c.signal);
      if (!current(c)) return;
      if (!validDocuments(docs)) throw new ApiError('invalid-response');
      patch({ documents: docs });
    } catch {
      if (current(c)) patch({ documentError: true });
    } finally {
      if (current(c)) {
        active = null;
        patch({ documentLoading: false });
      }
    }
  }
  async function submit() {
    if (stopped || active) return;
    const stage = state.stage;
    if (stage === 'email' && state.registration) {
      patch({ stage: 'consents', error: '' });
      if (!state.documents) await reload();
      return;
    }
    if (stage === 'email' && !registrationWork) {
      const email = state.email.trim().toLowerCase(),
        length = Array.from(state.password).length;
      const fields: SignupState['fields'] = {};
      if (
        !email ||
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      )
        fields.email = '이메일 주소를 확인해 주세요.';
      if (length < 8 || length > 128)
        fields.password = '비밀번호는 8~128자로 입력해 주세요.';
      if (state.password !== state.confirmation || !state.confirmation)
        fields.confirmation = '비밀번호가 일치하지 않아요.';
      patch({ fields, error: '' });
      if (Object.keys(fields).length) return;
      registrationWork = {
        key: `signup-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        credentials: { email, password: state.password },
      };
    }
    if (
      stage === 'consents' &&
      (!state.documents ||
        !state.choices.terms ||
        !state.choices.privacy ||
        !state.choices.processing)
    )
      return;
    if (stage === 'birth') {
      const issue = birthDateError(state.date, actions.today);
      if (issue) {
        patch({
          error:
            issue === 'future'
              ? '미래 날짜는 생일로 선택할 수 없어요.'
              : '생년월일을 확인해 주세요.',
        });
        return;
      }
    }
    if (!['email', 'consents', 'birth'].includes(stage)) return;
    const c = new AbortController();
    active = c;
    patch({ busy: true, error: '' });
    let needsDocuments = false;
    try {
      if (stage === 'email') {
        const work = registrationWork!;
        const result = await actions.register(
          work.key,
          { ...work.credentials },
          c.signal,
        );
        if (!current(c)) return;
        if (
          !result ||
          typeof result.id !== 'string' ||
          !result.id.trim() ||
          result.email !== work.credentials.email
        )
          throw new ApiError('invalid-response');
        registrationWork = null;
        patch({
          stage: 'consents',
          email: result.email,
          registration: result,
          password: '',
          confirmation: '',
          uncertain: false,
        });
        needsDocuments = true;
      } else if (stage === 'consents') {
        const result = await actions.consent(
          state.registration!.id,
          {
            revision: state.documents!.revision,
            choices: { ...state.choices },
          },
          c.signal,
        );
        if (!current(c)) return;
        if (result !== undefined) throw new ApiError('invalid-response');
        patch({ stage: 'birth' });
      } else {
        const date = birthWork ?? formatDate(state.date);
        birthWork = date;
        const result = await actions.birth(
          state.registration!.id,
          date,
          c.signal,
        );
        if (!current(c)) return;
        if (
          !validBirthDateResult(result) ||
          result.birth_date !== date ||
          result.edits_remaining !== 1
        )
          throw new ApiError('invalid-response');
        birthWork = null;
        patch({ stage: 'complete', result, birthUncertain: false });
      }
    } catch (error) {
      if (!current(c)) return;
      if (stage === 'email') {
        const rejected =
          error instanceof ApiError &&
          error.kind === 'http' &&
          [400, 409, 422].includes(error.status ?? 0);
        if (rejected) registrationWork = null;
        patch({
          uncertain: !rejected,
          error: rejected
            ? '이 이메일로 가입할 수 없어요. 입력 내용을 확인해 주세요.'
            : '가입 결과를 확인하지 못했어요. 같은 요청으로 다시 확인해 주세요.',
        });
      } else if (
        stage === 'consents' &&
        error instanceof ApiError &&
        error.code === 'CONSENT_VERSION_CHANGED'
      ) {
        patch({
          documents: null,
          choices: unchecked(),
          error:
            '동의 문서가 바뀌었어요. 새 내용을 확인하고 다시 선택해 주세요.',
        });
        needsDocuments = true;
      } else {
        const rejected =
          error instanceof ApiError &&
          error.kind === 'http' &&
          [400, 409, 422].includes(error.status ?? 0);
        if (stage === 'birth' && rejected) birthWork = null;
        patch({
          birthUncertain: stage === 'birth' && !rejected,
          error:
            error instanceof ApiError && error.code === 'AGE_NOT_ALLOWED'
              ? '입력한 생년월일로는 계속할 수 없어요. 생일을 다시 확인해 주세요.'
              : stage === 'birth' && !rejected
                ? '생일 저장 결과를 확인하지 못했어요. 같은 날짜로 다시 확인해 주세요.'
                : '저장 결과를 확인하지 못했어요. 입력은 유지했으니 다시 시도해 주세요.',
        });
      }
    } finally {
      if (current(c)) {
        active = null;
        patch({ busy: false });
      }
    }
    if (needsDocuments && !stopped) await reload();
  }
  return {
    start() {
      stopped = false;
    },
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    openSignup() {
      if (!stopped && !active) patch({ stage: 'email', error: '' });
    },
    openLogin() {
      if (!stopped && !active) patch({ stage: 'login', error: '' });
    },
    back() {
      if (stopped || state.busy) return;
      active?.abort();
      active = null;
      const stage =
        state.stage === 'birth'
          ? 'consents'
          : state.stage === 'consents'
            ? 'email'
            : 'welcome';
      patch({ stage, error: '', documentLoading: false });
    },
    edit(field: 'email' | 'password' | 'confirmation', value: string) {
      if (
        !stopped &&
        !active &&
        state.stage === 'email' &&
        !state.registration &&
        !state.uncertain
      )
        patch({
          [field]: value,
          fields: { ...state.fields, [field]: undefined },
          error: '',
        });
    },
    toggle(id: ConsentId | 'all') {
      if (stopped || active || state.stage !== 'consents' || !state.documents)
        return;
      if (id === 'all') {
        const checked = !consentIds.every((key) => state.choices[key]);
        patch({
          choices: {
            terms: checked,
            privacy: checked,
            processing: checked,
            notifications: checked,
          },
          error: '',
        });
      } else
        patch({
          choices: { ...state.choices, [id]: !state.choices[id] },
          error: '',
        });
    },
    changeDate(part: keyof DateParts, value: number) {
      if (
        !stopped &&
        !active &&
        !state.birthUncertain &&
        state.stage === 'birth'
      )
        patch({ date: withDatePart(state.date, part, value), error: '' });
    },
    submit,
    reload,
    stop() {
      stopped = true;
      active?.abort();
      active = null;
      registrationWork = null;
      birthWork = null;
      patch({
        password: '',
        confirmation: '',
        busy: false,
        documentLoading: false,
      });
    },
  };
}
export type SignupController = ReturnType<typeof createSignupController>;
