import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShelfInput } from '@/components/council-shelf/ShelfInput';

// F31 — helper to force a re-render with new props on an already-mounted
// input. Wraps ShelfInput in a stateful shell so we can flip `autoFocus`
// false → true and verify the late-autofocus effect fires — simulating
// the greeting finishing mid-lifecycle.
function LateFocusHarness({ initialAutoFocus = false }: { initialAutoFocus?: boolean }) {
  const [autoFocus, setAutoFocus] = useState(initialAutoFocus);
  return (
    <>
      <button type="button" onClick={() => setAutoFocus(true)}>flip</button>
      <ShelfInput onSubmit={() => {}} autoFocus={autoFocus} />
    </>
  );
}

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

  it('does not steal focus on mount when autoFocus is false (F31 greeting period)', () => {
    render(<ShelfInput onSubmit={() => {}} autoFocus={false} />);
    const field = screen.getByLabelText(/message to the council/i);
    expect(document.activeElement).not.toBe(field);
  });

  it('focuses the input when autoFocus transitions false → true (F31 post-greeting)', () => {
    render(<LateFocusHarness />);
    const field = screen.getByLabelText(/message to the council/i);
    expect(document.activeElement).not.toBe(field);
    fireEvent.click(screen.getByRole('button', { name: /flip/i }));
    expect(document.activeElement).toBe(field);
  });

  it('does not focus when autoFocus flips true while disabled (F31 mid-stream guard)', () => {
    // Simulates: greeting finished (autoFocus=true) but a follow-up
    // turn is already in flight (disabled=true). We should not grab
    // focus on top of the busy input.
    render(<ShelfInput onSubmit={() => {}} autoFocus disabled />);
    const field = screen.getByLabelText(/message to the council/i);
    expect(document.activeElement).not.toBe(field);
  });
});
