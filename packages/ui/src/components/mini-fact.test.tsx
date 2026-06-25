import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MiniFact } from './mini-fact';
import { StatusPill } from './status-pill';

describe('MiniFact', () => {
  it('renders label and value', () => {
    render(<MiniFact label="本月应付" value="¥1,119.00" />);
    expect(screen.getByText('本月应付')).toBeInTheDocument();
    expect(screen.getByText('¥1,119.00')).toBeInTheDocument();
  });
});

describe('StatusPill', () => {
  it('renders the status label', () => {
    render(<StatusPill label="数量短缺" />);
    expect(screen.getByText('数量短缺')).toBeInTheDocument();
  });
});
