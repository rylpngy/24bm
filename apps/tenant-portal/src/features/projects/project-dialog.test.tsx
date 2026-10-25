import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ProjectDialog } from './project-dialog';
afterEach(cleanup);
it('only the topmost project dialog handles Escape and restores the parent', () => {
  const parentClose = vi.fn();
  function Nested() {
    const [child, setChild] = useState(true);
    return (
      <ProjectDialog title="分包详情" onClose={parentClose}>
        {child && (
          <ProjectDialog title="选型" onClose={() => setChild(false)}>
            选型表单
          </ProjectDialog>
        )}
      </ProjectDialog>
    );
  }
  render(<Nested />);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(
    screen.queryByRole('dialog', { name: '选型' }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('dialog', { name: '分包详情' }),
  ).toBeVisible();
  expect(parentClose).not.toHaveBeenCalled();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(parentClose).toHaveBeenCalledOnce();
});
it('does not close a busy submission with Escape', () => {
  const close = vi.fn();
  render(
    <ProjectDialog title="正在下单" busy onClose={close}>
      提交中
    </ProjectDialog>,
  );
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(close).not.toHaveBeenCalled();
});
