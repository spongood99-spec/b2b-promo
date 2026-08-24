import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSignup } from './useAuth';
import './AuthForm.css';

export function SignupPage() {
  const [role, setRole] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [localError, setLocalError] = useState(null);
  const mutation = useSignup();

  function handleSubmit(e) {
    e.preventDefault();
    if (password !== passwordConfirm) {
      setLocalError('비밀번호가 일치하지 않습니다');
      return;
    }
    setLocalError(null);
    mutation.mutate({ role, company_name: companyName, email, password });
  }

  const errorMessage = localError || mutation.error?.message;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">CJ프레시웨이 프로모션 협업 앱</h1>
        <form className="auth-form" onSubmit={handleSubmit}>
          {errorMessage && <div className="form-error" role="alert">{errorMessage}</div>}
          <div className="form-field">
            <label>역할</label>
            <div className="form-field-radio-group">
              <label>
                <input
                  type="radio"
                  name="role"
                  required
                  value="partner"
                  checked={role === 'partner'}
                  onChange={(e) => setRole(e.target.value)}
                />
                협력사 담당자
              </label>
              <label>
                <input
                  type="radio"
                  name="role"
                  required
                  value="cj_freshway"
                  checked={role === 'cj_freshway'}
                  onChange={(e) => setRole(e.target.value)}
                />
                CJ프레시웨이 담당자
              </label>
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="company_name">소속사명</label>
            <input
              id="company_name"
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>
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
          <div className="form-field">
            <label htmlFor="passwordConfirm">비밀번호 확인</label>
            <input
              id="passwordConfirm"
              type="password"
              required
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary">가입하기</button>
        </form>
        <p className="auth-link">
          이미 계정이 있으신가요? <Link to="/login">로그인으로</Link>
        </p>
      </div>
    </div>
  );
}
