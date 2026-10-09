import { getCourseContent } from "../lib/course-access.mjs";

export async function onRequest(context) {
  return getCourseContent(context);
}