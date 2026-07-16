'use client';

// The app-wide drop target (tasks/data-revolution-plan.md Pillar 2, "there is
// currently NO app-wide drop target — verified"). Dragging a file in from the
// OS anywhere in the app shows a full-viewport studio overlay; dropping it
// feeds UniversalDropzone's own externally-fed-file flow (the same one the
// Rosa drawer uses), so every drop lands in the one shared classifier
// (lib/ingest/classify-document.ts) with no new upload path to maintain.
//
// Deliberately quiet: it only reacts to a real OS file drag (dataTransfer
// carries "Files"), not internal component drag-and-drop (list reordering,
// etc), and steps aside whenever a dialog already has its own drop target
// open (a Radix dialog is on screen) so it never fights a local dropzone.

import { useEffect, useRef, useState } from 'react';
import { UniversalDropzone } from './UniversalDropzone';

function hasOpenDialog(): boolean {
  return document.querySelector('[role="dialog"]') !== null;
}

function isFileDrag(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files');
}

export function GlobalDragLayer() {
  const [visible, setVisible] = useState(false);
  const [fileQueue, setFileQueue] = useState<File[]>([]);
  // Counter pattern: dragenter/dragleave fire on every child element as the
  // cursor moves over the page, so a plain boolean flickers. Only hide once
  // the counter returns to zero.
  const dragCounter = useRef(0);

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      if (hasOpenDialog()) return;
      e.preventDefault();
      dragCounter.current += 1;
      setVisible(true);
    };

    const onDragOver = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      if (hasOpenDialog()) return;
      // Required so the browser allows a drop instead of opening the file.
      e.preventDefault();
    };

    const onDragLeave = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      dragCounter.current = Math.max(0, dragCounter.current - 1);
      if (dragCounter.current === 0) setVisible(false);
    };

    const onDrop = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      dragCounter.current = 0;
      setVisible(false);
      if (hasOpenDialog()) return; // a local dropzone handles its own drop
      e.preventDefault();
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length > 0) setFileQueue((prev) => [...prev, ...files]);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragCounter.current > 0) {
        dragCounter.current = 0;
        setVisible(false);
      }
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const currentFile = fileQueue[0] ?? null;

  return (
    <>
      {visible && (
        <div
          className="pointer-events-none fixed inset-0 z-[9998] flex items-center justify-center bg-studio-ink/85 backdrop-blur-[2px] transition-opacity"
          aria-hidden
        >
          <div className="rounded-[6px] border border-studio-cream/25 bg-studio-ink px-8 py-6 text-center">
            <p className="font-display text-lg font-semibold text-studio-cream">Drop it.</p>
            <p className="mt-1 text-sm text-studio-cream/70">We will read it and file it.</p>
          </div>
        </div>
      )}

      {/* No visible trigger — driven purely by `file`, same contract the
          Rosa drawer uses to hand off an externally-supplied file. */}
      <UniversalDropzone
        file={currentFile}
        onFileConsumed={() => setFileQueue((prev) => prev.slice(1))}
      />
    </>
  );
}
