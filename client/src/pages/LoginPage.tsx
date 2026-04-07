import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import NuriAvatar from '../components/nuri/NuriAvatar';
import NuriBubble from '../components/nuri/NuriBubble';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg-light">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary to-[#0096B7] pt-12 pb-8 px-6 flex flex-col items-center">
        <NuriAvatar state="normal" size={90} />
        <h1 className="text-2xl font-extrabold text-white mt-3">¡Hola de nuevo!</h1>
        <p className="text-white/80 text-sm mt-1">Entra a tu cuenta de NutrIA</p>
      </div>

      <div className="flex-1 px-6 pt-6 pb-8">
        <NuriBubble
          message="¡Te echaba de menos! Venga, entra que te cuento cómo va todo."
          state="normal"
          className="mb-6"
        />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Email</label>
            <input
              type="email"
              className="input-field"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Contraseña</label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <motion.p
              className="text-alert text-sm font-medium text-center"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            >
              {error}
            </motion.p>
          )}

          <motion.button
            type="submit"
            className="btn-primary w-full mt-2"
            whileTap={{ scale: 0.97 }}
            disabled={loading}
          >
            {loading ? '🦦 Entrando...' : 'Entrar'}
          </motion.button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="text-primary font-bold">
            Regístrate gratis
          </Link>
        </p>
      </div>
    </div>
  );
}
