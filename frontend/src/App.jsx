import { useEffect, useState } from 'react';
import { AppRouter } from './routes/AppRouter';
import { doRefresh } from './api/client';

function App() {
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    doRefresh().catch(() => {}).finally(() => setBootstrapped(true));
  }, []);

  if (!bootstrapped) return null;

  return <AppRouter />;
}

export default App;
