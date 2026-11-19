import { createMockSignupJourney } from './signupJourney';
import { getNativeReminderSession } from '../notifications/nativeRuntime';
let source: ReturnType<typeof createMockSignupJourney> | null = null;
/** Process-local preview session. This is not authentication or disk restoration. */
export function getMockAppSession() {
  if (!source)
    source = createMockSignupJourney(
      getNativeReminderSession().reminder,
      'day',
      { startAt: Date.now() },
    );
  return source;
}
