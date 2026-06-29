import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/auth';
import { AuthLayout } from '../components/AuthLayout';

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);
    if (error) {
      toast.error(error);
    } else {
      setSent(true);
      toast.success('Reset link sent!');
    }
  };

  return (
    <AuthLayout>
      <Link to="/login" className="mb-6 flex items-center gap-2 text-sm text-muted hover:text-primary-500">
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </Link>

      {sent ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center py-8 text-center"
        >
          <CheckCircle className="mb-4 h-16 w-16 text-success-500" />
          <h1 className="font-display text-xl font-bold">Check your email</h1>
          <p className="mt-2 text-sm text-muted">
            We've sent a password reset link to <span className="font-semibold text-primary-500">{email}</span>
          </p>
        </motion.div>
      ) : (
        <>
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold">Reset password</h1>
            <p className="mt-1 text-sm text-muted">Enter your email and we'll send you a reset link.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input-field pl-11"
                />
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.98 }}
              className="btn-primary w-full py-3 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </motion.button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
