import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChipInput } from '@/components/council-shelf/ChipInput';

describe('ChipInput', () => {
  it('renders the compact state with the label', () => {
    render(<ChipInput label="scope?" onSubmit={() => {}} />);
    const btn = screen.getByRole('button', { name: /scope\?/ });
    expect(btn).toBeInTheDocument();
    expect(btn.getAttribute('data-chip-state')).toBe('compact');
  });

  it('expands into an input when the compact chip is clicked', () => {
    render(<ChipInput label="by when?" onSubmit={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /by when\?/ }));
    const input = screen.getByPlaceholderText('by when?') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.closest('form')?.getAttribute('data-chip-state')).toBe(
      'expanded',
    );
  });

  it('fires onSubmit with the trimmed value and collapses again', () => {
    const onSubmit = vi.fn();
    render(<ChipInput label="scope?" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /scope\?/ }));
    const input = screen.getByPlaceholderText('scope?') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '  everything user-facing  ' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(onSubmit).toHaveBeenCalledWith('everything user-facing');
    // Collapses back to compact.
    expect(
      screen.getByRole('button', { name: /scope\?/ }).getAttribute('data-chip-state'),
    ).toBe('compact');
  });

  it('does not fire onSubmit for whitespace-only input', () => {
    const onSubmit = vi.fn();
    render(<ChipInput label="scope?" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /scope\?/ }));
    const input = screen.getByPlaceholderText('scope?') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('Escape collapses the expanded chip without firing onSubmit', () => {
    const onSubmit = vi.fn();
    render(<ChipInput label="scope?" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /scope\?/ }));
    const input = screen.getByPlaceholderText('scope?') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'typed' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: /scope\?/ }).getAttribute('data-chip-state'),
    ).toBe('compact');
  });

  it('respects disabled in both states', () => {
    const onSubmit = vi.fn();
    render(<ChipInput label="scope?" onSubmit={onSubmit} disabled />);
    const btn = screen.getByRole('button', { name: /scope\?/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    // Should NOT have expanded.
    expect(screen.queryByPlaceholderText('scope?')).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
