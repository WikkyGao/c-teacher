export const defaultChildDetailWidth = 380;

const minStudentDetailWidth = 320;
const maxStudentDetailWidth = 640;

export function clampChildDetailWidth(width: number) {
  return Math.min(Math.max(Math.round(width), minStudentDetailWidth), maxStudentDetailWidth);
}
