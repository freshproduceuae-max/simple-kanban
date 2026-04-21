import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShelfInput } from '@/components/council-shelf/ShelfInput';

describe('ShelfInput', () => {
  it('fires onSubmit with trimmed text on Enter', () => {
    const onSubmit = vi.fn();
    render(<ShelfInput onSubmit={onSubmit} />);
    const field = screen.getByLabelText(/message to the council/i);
    fireEvent.change(field, { target: { value: '  hello  ' } });
    fireEvent.submit(field.closest('form') as HTMLFormElement);
    expect(onSubmit).toHaveBeenCalledWith('hello');
  });

  it('clears the field after submit', () => {
    const onSubmit = vi.fn();
    render(<ShelfInput onSubmit={onSubmit} />);
    const field = screen.getByLabelText(/message to the council/i) as HTMLInputElement;
    fireEvent.change(field, { target: { value: 'what is up' } });
    fireEvent.submit(field.closest('form') as HTMLFormElement);
    expect(field.value).toBe('');
  });

  it('does not fire onSubmit when disabled', () => {
    const onSubmit = vi.fn();
    render(<ShelfInput onSubmit={onSubmit} disabled />);
    const field = screen.getByLabelText(/message to the council/i);
    fireEvent.change(field, { target: { value: 'hi' } });
    fireEvent.submit(field.closest('form') as HTMLFormElement);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not fire onSubmit for whitespace-only input', () => {
    const onSubmit = vi.fn();
    render(<ShelfInput onSubmit={onSubmit} />);
    const field = screen.getByLabelText(/message to the council/i);
    fireEvent.change(field, { target: { value: '     ' } });
    fireEvent.submit(field.closest('form') as HTMLFormElement);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables the Send button while value is empty', () => {
    render(<ShelfInput onSubmit={() => {}} />);
    const btn = screen.getByRole('button', { name: /send/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('uses a provided placeholder', () => {
    render(<ShelfInput onSubmit={() => {}} placeholder="Type here…" />);
    expect(screen.getByPlaceholderText('Type here…')).toBeInTheDocument();
  });
});
