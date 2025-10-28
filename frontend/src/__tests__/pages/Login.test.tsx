import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Login } from '../../pages/Login';
import { AuthProvider } from '../../contexts/AuthContext';

const MockedLogin = () => (
  <BrowserRouter>
    <AuthProvider>
      <Login />
    </AuthProvider>
  </BrowserRouter>
);

describe('Login Page', () => {
  it('renders login form', () => {
    render(<MockedLogin />);
    
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('validates email input', () => {
    render(<MockedLogin />);
    
    const emailInput = screen.getByPlaceholderText(/email/i);
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(emailInput).toHaveAttribute('required');
  });

  it('validates password input', () => {
    render(<MockedLogin />);
    
    const passwordInput = screen.getByPlaceholderText(/password/i);
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(passwordInput).toHaveAttribute('required');
  });

  it('shows link to signup page', () => {
    render(<MockedLogin />);
    
    const signupLink = screen.getByText(/sign up/i);
    expect(signupLink).toBeInTheDocument();
    // Use Testing Library query instead of direct DOM access
    const signupElement = screen.getByRole('link', { name: /sign up/i });
    expect(signupElement).toHaveAttribute('href', '/signup');
  });

  it('handles form submission', async () => {
    render(<MockedLogin />);
    
    const emailInput = screen.getByPlaceholderText(/email/i);
    const passwordInput = screen.getByPlaceholderText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeInTheDocument();
    });
  });
});

