import { requireAuthenticatedUser, jsonResponse } from "./auth.mjs";

function positiveId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function projectLessons(lessons, entitled) {
  return lessons.map(lesson => {
    const free = Number(lesson.is_free) === 1 || lesson.is_free === true;
    const contentAvailable = free || entitled;
    const projected = {
      id: lesson.id,
      chapter_id: lesson.chapter_id,
      title: lesson.title,
      description: lesson.description || "",
      image: lesson.image || "",
      is_free: free ? 1 : 0,
      sort_order: lesson.sort_order,
      contentAvailable
    };

    // Never send paid lesson text or URLs to guests/non-owners.
    if (contentAvailable) {
      projected.content_type = lesson.content_type || "text";
      projected.content_text = lesson.content_text || "";
      projected.content_url = lesson.content_url || "";
    }
    return projected;
  });
}

export async function getCourseContent({ request, env }) {
  if (request.method !== "GET") {
    return jsonResponse({ error: "روش درخواست پشتیبانی نمی‌شود." }, 405, { Allow: "GET" });
  }
  if (!env?.DB || typeof env.DB.prepare !== "function") {
    return jsonResponse({ error: "پایگاه داده در دسترس نیست." }, 503);
  }

  const courseId = positiveId(new URL(request.url).searchParams.get("course_id"));
  if (!courseId) return jsonResponse({ error: "شناسه دوره معتبر نیست." }, 400);

  try {
    const course = await env.DB.prepare(`
      SELECT id, title, slug, description, image, active
      FROM courses
      WHERE id = ? AND active = 1
      LIMIT 1
    `).bind(courseId).first();
    if (!course) return jsonResponse({ error: "دوره پیدا نشد." }, 404);

    const chapterResult = await env.DB.prepare(`
      SELECT id, course_id, title, sort_order
      FROM course_chapters
      WHERE course_id = ?
      ORDER BY sort_order ASC, id ASC
    `).bind(courseId).all();

    const lessonResult = await env.DB.prepare(`
      SELECT l.id, l.chapter_id, l.title, l.description, l.content_type,
             l.content_url, l.content_text, l.image, l.is_free,
             l.sort_order, l.active
      FROM course_lessons l
      JOIN course_chapters c ON c.id = l.chapter_id
      WHERE c.course_id = ? AND l.active = 1
      ORDER BY c.sort_order ASC, c.id ASC, l.sort_order ASC, l.id ASC
    `).bind(courseId).all();

    const user = await requireAuthenticatedUser(request, env);
    let entitled = false;
    if (user) {
      const entitlement = await env.DB.prepare(`
        SELECT e.id
        FROM course_entitlements e
        JOIN course_orders o
          ON o.id = e.course_order_id
         AND o.user_id = e.user_id
         AND o.course_id = e.course_id
        JOIN users u ON u.id = e.user_id
        WHERE e.user_id = ?
          AND e.course_id = ?
          AND o.status = 'paid'
          AND o.verified_at IS NOT NULL
          AND u.phone_verified_at IS NOT NULL
        LIMIT 1
      `).bind(user.id, courseId).first();
      entitled = Boolean(entitlement?.id);
    }

    const lessons = projectLessons(lessonResult.results || [], entitled);
    return jsonResponse({
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description || "",
        image: course.image || ""
      },
      authenticated: Boolean(user),
      entitled,
      chapters: chapterResult.results || [],
      lessons
    });
  } catch {
    // Missing/unapplied stage-2/3 tables or query errors must fail closed.
    return jsonResponse({
      error: "نمایش محتوای دوره فعلاً در دسترس نیست؛ ساختار پایگاه داده آماده نیست."
    }, 503);
  }
}