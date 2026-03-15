import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/useToast';
import { Music, Loader2, Headphones, Radio, Disc3 } from 'lucide-react';

const GOOGLE_CLIENT_ID = '614064235673-1v5jvb3npg0i5n6946gvto96ercdc7er.apps.googleusercontent.com';

// Extend Window to include the Google GSI types
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

// ── helpers ───────────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

function validateLogin(email: string, password: string) {
  const errors: Record<string, string> = {};
  if (!email) errors.email = 'Email is required.';
  else if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';
  if (!password) errors.password = 'Password is required.';
  return errors;
}

function validateRegister(form: { username: string; email: string; password: string; display_name: string }) {
  const errors: Record<string, string> = {};
  if (!form.username) errors.username = 'Username is required.';
  else if (form.username.length < 3) errors.username = 'Username must be at least 3 characters.';
  else if (form.username.length > 50) errors.username = 'Username must be at most 50 characters.';
  else if (!USERNAME_RE.test(form.username)) errors.username = 'Username can only contain letters, numbers and underscores.';
  if (!form.email) errors.email = 'Email is required.';
  else if (!EMAIL_RE.test(form.email)) errors.email = 'Enter a valid email address.';
  if (!form.password) errors.password = 'Password is required.';
  else if (form.password.length < 6) errors.password = 'Password must be at least 6 characters.';
  if (form.display_name && form.display_name.length < 3) errors.display_name = 'Display name must be at least 3 characters.';
  return errors;
}

export function Auth() {
  const navigate = useNavigate();
  const { login, register, loginWithGoogle } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const googleBtnLoginRef = useRef<HTMLDivElement>(null);
  const googleBtnRegisterRef = useRef<HTMLDivElement>(null);

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginErrors, setLoginErrors] = useState<Record<string, string>>({});
  const [registerForm, setRegisterForm] = useState({
    username: '',
    email: '',
    password: '',
    display_name: '',
    producer_type: '',
  });
  const [registerErrors, setRegisterErrors] = useState<Record<string, string>>({});

  // Load Google Identity Services script and initialize
  useEffect(() => {
    const handleGoogleResponse = async (response: { credential: string }) => {
      setIsLoading(true);
      try {
        await loginWithGoogle(response.credential);
        navigate('/');
        toast({ title: 'Welcome to BeatConnect!', variant: 'default' });
      } catch (error: any) {
        toast({
          title: 'Google sign-in failed',
          description: error.message || 'Something went wrong',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    const initGoogle = () => {
      if (!window.google) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
      });
      if (googleBtnLoginRef.current) {
        window.google.accounts.id.renderButton(googleBtnLoginRef.current, {
          theme: 'outline',
          size: 'large',
          width: 360,
          text: 'signin_with',
          shape: 'rectangular',
        });
      }
      if (googleBtnRegisterRef.current) {
        window.google.accounts.id.renderButton(googleBtnRegisterRef.current, {
          theme: 'outline',
          size: 'large',
          width: 360,
          text: 'signup_with',
          shape: 'rectangular',
        });
      }
    };

    // If script already loaded
    if (window.google) {
      initGoogle();
      return;
    }

    // Load the GSI script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initGoogle;
    document.head.appendChild(script);

    return () => {
      // Clean up script on unmount if we added it
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existingScript && existingScript.parentNode) {
        existingScript.parentNode.removeChild(existingScript);
      }
    };
  }, [loginWithGoogle, navigate]);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateLogin(loginForm.email, loginForm.password);
    setLoginErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsLoading(true);
    try {
      await login(loginForm.email, loginForm.password);
      navigate('/');
      toast({ title: 'Welcome back!', variant: 'default' });
    } catch (error: any) {
      toast({
        title: 'Login failed',
        description: error.message || 'Invalid credentials',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateRegister(registerForm);
    setRegisterErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsLoading(true);
    try {
      await register(registerForm);
      navigate('/');
      toast({ title: 'Welcome to BeatConnect!', variant: 'default' });
    } catch (error: any) {
      toast({
        title: 'Registration failed',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-vinyl-gradient overflow-hidden">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Floating gradient orbs */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-beat-purple/30 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-beat-pink/30 rounded-full blur-3xl animate-float-slow-reverse" />
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-beat-cyan/20 rounded-full blur-3xl animate-float-medium" />

        {/* Floating music icons */}
        <div className="absolute top-[15%] left-[10%] animate-float-icon-1">
          <Headphones className="w-12 h-12 text-beat-purple/30" />
        </div>
        <div className="absolute top-[25%] right-[15%] animate-float-icon-2">
          <Radio className="w-10 h-10 text-beat-pink/30" />
        </div>
        <div className="absolute bottom-[20%] left-[20%] animate-float-icon-3">
          <Music className="w-14 h-14 text-beat-cyan/30" />
        </div>
        <div className="absolute bottom-[30%] right-[10%] animate-float-icon-4">
          <Disc3 className="w-16 h-16 text-beat-orange/30 animate-spin-slow" />
        </div>
        <div className="absolute top-[60%] left-[5%] animate-float-icon-2">
          <Disc3 className="w-8 h-8 text-beat-purple/20 animate-spin-slow" />
        </div>
        <div className="absolute top-[10%] right-[30%] animate-float-icon-3">
          <Headphones className="w-8 h-8 text-beat-pink/20" />
        </div>

        {/* Animated sound waves */}
        <div className="absolute bottom-0 left-0 right-0 h-32 flex items-end justify-center gap-1 opacity-20">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="w-2 bg-gradient-to-t from-beat-purple to-beat-pink rounded-full animate-soundwave"
              style={{
                animationDelay: `${i * 0.05}s`,
                height: '20%',
              }}
            />
          ))}
        </div>

        {/* Particle effect */}
        <div className="absolute inset-0">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-beat-purple/40 rounded-full animate-particle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${3 + Math.random() * 4}s`,
              }}
            />
          ))}
        </div>
      </div>

      <Card className="w-full max-w-md relative z-10 animate-card-entrance backdrop-blur-sm bg-card/95 border-beat-purple/20">
        <CardHeader className="text-center">
          {/* Animated Logo */}
          <div className="relative w-20 h-20 mx-auto mb-4">
            {/* Outer rotating ring */}
            <div className="absolute inset-0 rounded-full border-2 border-beat-purple/30 animate-spin-slow" />
            <div className="absolute inset-1 rounded-full border-2 border-beat-pink/30 animate-spin-slow-reverse" />
            {/* Inner logo */}
            <div className="absolute inset-2 rounded-full bg-gradient-to-br from-beat-purple to-beat-pink flex items-center justify-center animate-logo-pulse">
              <Music className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold music-gradient-text animate-title-entrance">
            BeatConnect
          </CardTitle>
          <CardDescription className="animate-subtitle-entrance">
            Connect through the power of music
          </CardDescription>
        </CardHeader>
        <CardContent className="animate-content-entrance">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="animate-tab-content">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2 animate-field-entrance" style={{ animationDelay: '0.1s' }}>
                  <label htmlFor="login-email" className="text-sm font-medium">
                    Email
                  </label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="producer@beatconnect.com"
                    value={loginForm.email}
                    onChange={(e) => { setLoginForm({ ...loginForm, email: e.target.value }); setLoginErrors((p) => ({ ...p, email: '' })); }}
                    className={`transition-all duration-300 focus:scale-[1.02]${loginErrors.email ? ' border-destructive' : ''}`}
                  />
                  {loginErrors.email && <p className="text-xs text-destructive">{loginErrors.email}</p>}
                </div>
                <div className="space-y-2 animate-field-entrance" style={{ animationDelay: '0.2s' }}>
                  <label htmlFor="login-password" className="text-sm font-medium">
                    Password
                  </label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="Enter your password"
                    value={loginForm.password}
                    onChange={(e) => { setLoginForm({ ...loginForm, password: e.target.value }); setLoginErrors((p) => ({ ...p, password: '' })); }}
                    className={`transition-all duration-300 focus:scale-[1.02]${loginErrors.password ? ' border-destructive' : ''}`}
                  />
                  {loginErrors.password && <p className="text-xs text-destructive">{loginErrors.password}</p>}
                </div>
                <Button
                  type="submit"
                  className="w-full animate-field-entrance transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-beat-purple/25"
                  style={{ animationDelay: '0.3s' }}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>

                {/* Divider */}
                <div className="relative animate-field-entrance" style={{ animationDelay: '0.35s' }}>
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or continue with</span>
                  </div>
                </div>

                {/* Google Sign-In Button */}
                <div
                  ref={googleBtnLoginRef}
                  className="w-full flex justify-center animate-field-entrance"
                  style={{ animationDelay: '0.4s' }}
                />
              </form>
            </TabsContent>

            <TabsContent value="register" className="animate-tab-content">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2 animate-field-entrance" style={{ animationDelay: '0.1s' }}>
                  <label htmlFor="reg-username" className="text-sm font-medium">
                    Username <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="reg-username"
                    placeholder="beatmaker123"
                    value={registerForm.username}
                    onChange={(e) => { setRegisterForm({ ...registerForm, username: e.target.value }); setRegisterErrors((p) => ({ ...p, username: '' })); }}
                    className={`transition-all duration-300 focus:scale-[1.02]${registerErrors.username ? ' border-destructive' : ''}`}
                  />
                  {registerErrors.username
                    ? <p className="text-xs text-destructive">{registerErrors.username}</p>
                    : <p className="text-xs text-muted-foreground">3–50 characters, letters, numbers and underscores only.</p>}
                </div>
                <div className="space-y-2 animate-field-entrance" style={{ animationDelay: '0.15s' }}>
                  <label htmlFor="reg-displayname" className="text-sm font-medium">
                    Display Name
                  </label>
                  <Input
                    id="reg-displayname"
                    placeholder="DJ Beat"
                    value={registerForm.display_name}
                    onChange={(e) => { setRegisterForm({ ...registerForm, display_name: e.target.value }); setRegisterErrors((p) => ({ ...p, display_name: '' })); }}
                    className={`transition-all duration-300 focus:scale-[1.02]${registerErrors.display_name ? ' border-destructive' : ''}`}
                  />
                  {registerErrors.display_name && <p className="text-xs text-destructive">{registerErrors.display_name}</p>}
                </div>
                <div className="space-y-2 animate-field-entrance" style={{ animationDelay: '0.2s' }}>
                  <label htmlFor="reg-email" className="text-sm font-medium">
                    Email <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="producer@beatconnect.com"
                    value={registerForm.email}
                    onChange={(e) => { setRegisterForm({ ...registerForm, email: e.target.value }); setRegisterErrors((p) => ({ ...p, email: '' })); }}
                    className={`transition-all duration-300 focus:scale-[1.02]${registerErrors.email ? ' border-destructive' : ''}`}
                  />
                  {registerErrors.email && <p className="text-xs text-destructive">{registerErrors.email}</p>}
                </div>
                <div className="space-y-2 animate-field-entrance" style={{ animationDelay: '0.25s' }}>
                  <label htmlFor="reg-producer-type" className="text-sm font-medium">
                    Producer Type
                  </label>
                  <Input
                    id="reg-producer-type"
                    placeholder="e.g., Hip-Hop Producer, EDM Artist"
                    value={registerForm.producer_type}
                    onChange={(e) => setRegisterForm({ ...registerForm, producer_type: e.target.value })}
                    className="transition-all duration-300 focus:scale-[1.02]"
                  />
                </div>
                <div className="space-y-2 animate-field-entrance" style={{ animationDelay: '0.3s' }}>
                  <label htmlFor="reg-password" className="text-sm font-medium">
                    Password <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="reg-password"
                    type="password"
                    placeholder="Create a password"
                    value={registerForm.password}
                    onChange={(e) => { setRegisterForm({ ...registerForm, password: e.target.value }); setRegisterErrors((p) => ({ ...p, password: '' })); }}
                    className={`transition-all duration-300 focus:scale-[1.02]${registerErrors.password ? ' border-destructive' : ''}`}
                  />
                  {registerErrors.password
                    ? <p className="text-xs text-destructive">{registerErrors.password}</p>
                    : <p className="text-xs text-muted-foreground">At least 6 characters.</p>}
                </div>
                <Button
                  type="submit"
                  className="w-full animate-field-entrance transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-beat-purple/25"
                  style={{ animationDelay: '0.35s' }}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>

                {/* Divider */}
                <div className="relative animate-field-entrance" style={{ animationDelay: '0.4s' }}>
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or sign up with</span>
                  </div>
                </div>

                {/* Google Sign-Up Button */}
                <div
                  ref={googleBtnRegisterRef}
                  className="w-full flex justify-center animate-field-entrance"
                  style={{ animationDelay: '0.45s' }}
                />
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
