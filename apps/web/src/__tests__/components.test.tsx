// =============================================================================
// Web Admin — UI Component unit tests
//
// Tests the Button and Card component variants, sizes, states, and rendering.
// =============================================================================

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import { Button } from '../components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '../components/ui/card';

// ---------------------------------------------------------------------------
// Button tests
// ---------------------------------------------------------------------------

describe('Button', () => {
  it('should render children text', () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByText('Click Me')).toBeDefined();
  });

  it('should apply primary variant styles by default', () => {
    render(<Button>Primary</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-lurk-600');
  });

  it('should apply secondary variant styles', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-surface-200');
  });

  it('should apply danger variant styles', () => {
    render(<Button variant="danger">Danger</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-red-600');
  });

  it('should apply ghost variant styles', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-transparent');
  });

  it('should apply outline variant styles', () => {
    render(<Button variant="outline">Outline</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('border');
    expect(btn.className).toContain('bg-transparent');
  });

  it('should apply size classes', () => {
    const { rerender } = render(<Button size="xs">XS</Button>);
    expect(screen.getByRole('button').className).toContain('text-xs');
    expect(screen.getByRole('button').className).toContain('px-2');

    rerender(<Button size="lg">LG</Button>);
    expect(screen.getByRole('button').className).toContain('px-5');
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    const btn = screen.getByRole('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('should be disabled when loading is true', () => {
    render(<Button loading>Loading</Button>);
    const btn = screen.getByRole('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('should show spinner SVG when loading', () => {
    render(<Button loading>Loading</Button>);
    const btn = screen.getByRole('button');
    const svg = btn.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.classList.contains('animate-spin')).toBe(true);
  });

  it('should render icon on the left', () => {
    const icon = <span data-testid="left-icon">*</span>;
    render(<Button icon={icon}>With Icon</Button>);
    expect(screen.getByTestId('left-icon')).toBeDefined();
  });

  it('should render icon on the right', () => {
    const icon = <span data-testid="right-icon">></span>;
    render(<Button iconRight={icon}>With Right Icon</Button>);
    expect(screen.getByTestId('right-icon')).toBeDefined();
  });

  it('should apply fullWidth class', () => {
    render(<Button fullWidth>Full Width</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('w-full');
  });

  it('should forward additional className', () => {
    render(<Button className="custom-class">Custom</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('custom-class');
  });

  it('should handle click events', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Clickable</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should not show icon when loading', () => {
    const icon = <span data-testid="my-icon">*</span>;
    render(<Button loading icon={icon}>Loading</Button>);
    // The spinner should be shown instead of the icon
    const btn = screen.getByRole('button');
    const svg = btn.querySelector('svg.animate-spin');
    expect(svg).not.toBeNull();
    // The icon should NOT be rendered when loading
    expect(screen.queryByTestId('my-icon')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Card tests
// ---------------------------------------------------------------------------

describe('Card', () => {
  it('should render children', () => {
    render(<Card>Card Content</Card>);
    expect(screen.getByText('Card Content')).toBeDefined();
  });

  it('should apply default variant styles', () => {
    const { container } = render(<Card>Default</Card>);
    const div = container.firstElementChild as HTMLElement;
    expect(div.className).toContain('bg-surface-100');
    expect(div.className).toContain('border');
  });

  it('should apply bordered variant', () => {
    const { container } = render(<Card variant="bordered">Bordered</Card>);
    const div = container.firstElementChild as HTMLElement;
    expect(div.className).toContain('bg-surface-50');
  });

  it('should apply ghost variant', () => {
    const { container } = render(<Card variant="ghost">Ghost</Card>);
    const div = container.firstElementChild as HTMLElement;
    expect(div.className).toContain('bg-transparent');
  });

  it('should apply glow variant', () => {
    const { container } = render(<Card variant="glow">Glow</Card>);
    const div = container.firstElementChild as HTMLElement;
    expect(div.className).toContain('glow-border');
  });

  it('should apply padding sizes', () => {
    const { container, rerender } = render(<Card padding="none">None</Card>);
    // "none" padding should not add p-* classes
    let div = container.firstElementChild as HTMLElement;
    expect(div.className).not.toContain('p-5');

    rerender(<Card padding="lg">LG</Card>);
    div = container.firstElementChild as HTMLElement;
    expect(div.className).toContain('p-6');
  });

  it('should apply hover styles when hover prop is true', () => {
    const { container } = render(<Card hover>Hoverable</Card>);
    const div = container.firstElementChild as HTMLElement;
    expect(div.className).toContain('hover:bg-surface-200');
    expect(div.className).toContain('cursor-pointer');
  });

  it('should set cursor-pointer when onClick is provided', () => {
    const onClick = vi.fn();
    const { container } = render(<Card onClick={onClick}>Clickable</Card>);
    const div = container.firstElementChild as HTMLElement;
    expect(div.className).toContain('cursor-pointer');
  });

  it('should call onClick handler', () => {
    const onClick = vi.fn();
    const { container } = render(<Card onClick={onClick}>Clickable</Card>);
    fireEvent.click(container.firstElementChild!);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should accept custom className', () => {
    const { container } = render(<Card className="my-card">Custom</Card>);
    const div = container.firstElementChild as HTMLElement;
    expect(div.className).toContain('my-card');
  });
});

describe('Card sub-components', () => {
  it('CardHeader renders with flex layout', () => {
    const { container } = render(<CardHeader>Header</CardHeader>);
    const div = container.firstElementChild as HTMLElement;
    expect(div.className).toContain('flex');
    expect(div.className).toContain('items-center');
  });

  it('CardTitle renders as h3', () => {
    render(<CardTitle>My Title</CardTitle>);
    const h3 = screen.getByText('My Title');
    expect(h3.tagName).toBe('H3');
    expect(h3.className).toContain('font-semibold');
  });

  it('CardDescription renders as p with muted text', () => {
    render(<CardDescription>Description text</CardDescription>);
    const p = screen.getByText('Description text');
    expect(p.tagName).toBe('P');
    expect(p.className).toContain('text-gray-500');
  });

  it('CardContent renders children', () => {
    render(<CardContent>Inner content</CardContent>);
    expect(screen.getByText('Inner content')).toBeDefined();
  });

  it('CardFooter renders with border-t', () => {
    const { container } = render(<CardFooter>Footer</CardFooter>);
    const div = container.firstElementChild as HTMLElement;
    expect(div.className).toContain('border-t');
    expect(div.className).toContain('mt-4');
  });

  it('all sub-components accept custom className', () => {
    const { container: c1 } = render(<CardHeader className="ch">H</CardHeader>);
    expect((c1.firstElementChild as HTMLElement).className).toContain('ch');

    const { container: c2 } = render(<CardTitle className="ct">T</CardTitle>);
    expect((c2.firstElementChild as HTMLElement).className).toContain('ct');

    const { container: c3 } = render(<CardContent className="cc">C</CardContent>);
    expect((c3.firstElementChild as HTMLElement).className).toContain('cc');

    const { container: c4 } = render(<CardFooter className="cf">F</CardFooter>);
    expect((c4.firstElementChild as HTMLElement).className).toContain('cf');
  });
});
