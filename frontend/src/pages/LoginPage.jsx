/**
 * Login Page Component
 * Premium dark mode login interface
 */

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import './LoginPage.css';

function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(username, password);

        if (!result.success) {
            setError(result.message);
            setLoading(false);
        }
    };

    const demoAccounts = [
        { username: 'student1', password: 'password123', role: 'Student' },
        { username: 'driver1', password: 'password123', role: 'Driver' },
        { username: 'admin', password: 'password123', role: 'Admin' }
    ];

    const fillDemo = (account) => {
        setUsername(account.username);
        setPassword(account.password);
        setError('');
    };

    return (
        <div className="login-page">
            <div className="login-background">
                <div className="gradient-orb orb-1"></div>
                <div className="gradient-orb orb-2"></div>
                <div className="gradient-orb orb-3"></div>
            </div>

            <div className="theme-toggle-container">
                <ThemeToggle />
            </div>

            <div className="login-container">
                <div className="login-card card-glass">
                    <div className="login-header">
                        <div className="logo-container">
                            <div className="logo-icon">🚌</div>
                        </div>
                        <h1 className="login-title">College Bus Tracker</h1>
                        <p className="login-subtitle">Real-time Attendance & Tracking System</p>
                    </div>

                    <form onSubmit={handleSubmit} className="login-form">
                        {error && (
                            <div className="alert alert-error fade-in">
                                <span className="alert-icon">⚠️</span>
                                {error}
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Username</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Enter your username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <input
                                type="password"
                                className="form-input"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-block"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <span className="spin">⏳</span>
                                    Logging in...
                                </>
                            ) : (
                                <>
                                    <span>🔐</span>
                                    Login
                                </>
                            )}
                        </button>
                    </form>

                    <div className="demo-accounts">
                        <p className="demo-title">Demo Accounts</p>
                        <div className="demo-grid">
                            {demoAccounts.map((account, index) => (
                                <button
                                    key={index}
                                    className="demo-btn"
                                    onClick={() => fillDemo(account)}
                                    type="button"
                                >
                                    <span className="demo-role">{account.role}</span>
                                    <span className="demo-username">{account.username}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="login-footer">
                    <p>Built with ❤️ for College Students</p>
                    <p className="text-muted">Real-time GPS • Attendance Lock • Notifications</p>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;
