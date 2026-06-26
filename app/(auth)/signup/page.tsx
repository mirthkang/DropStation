import { SignupForm } from '@/components/auth/signup';
import { isPublicRegistrationEnabled } from '@/library/server/settings';
import { getUserCount } from '@/library/server/users';

export default async function Signup() {
  const [registrationEnabled, userCount] = await Promise.all([
    isPublicRegistrationEnabled(),
    getUserCount(),
  ]);

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <SignupForm registrationEnabled={registrationEnabled || userCount === 0} />
      </div>
    </div>
  );
}
