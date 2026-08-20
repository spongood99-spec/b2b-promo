import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLogin } from './useAuth';
import './AuthForm.css';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const mutation = useLogin();

  function handleSubmit(e) {
    e.preventDefault();
    mutation.mutate({ email, password });
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">CJ프레시웨이 프로모션 협업 앱</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          {mutation.isError && (
            <div className="form-error">이메일 또는 비밀번호가 올바르지 않습니다</div>
          )}
          <div className="form-field">
            <label htmlFor="email">이메일</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary">로그인</button>
        </form>
        <p className="auth-link">
          아직 계정이 없으신가요? <Link to="/signup">회원가입 하기</Link>
        </p>
      </div>
    </div>
  );
}
