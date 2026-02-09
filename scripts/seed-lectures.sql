-- Seed Lectures for All Courses (C2–C10)
-- Run in Supabase SQL Editor. Idempotent: safe to run multiple times.

DO $$
DECLARE
  v_course_id TEXT;
  v_module_id TEXT;
BEGIN

  -- ============================================================
  -- C2: Confidence From Within
  -- ============================================================
  SELECT id INTO v_course_id FROM courses WHERE slug = 'confidence-from-within';
  IF v_course_id IS NOT NULL THEN

    -- M1: True vs False Confidence
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'True vs False Confidence') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'True vs False Confidence', 0, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'True vs False Confidence';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction to Authentic Confidence') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction to Authentic Confidence', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Understanding True Confidence') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Understanding True Confidence', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Problem with Performed Confidence') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Problem with Performed Confidence', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Self-Assessment and Patterns') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Self-Assessment and Patterns', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Reflection') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Reflection', 'video', 'both', false, 4, NOW(), NOW());
    END IF;

    -- M2: Meeting Your Inner Critic
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Meeting Your Inner Critic') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Meeting Your Inner Critic', 1, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Meeting Your Inner Critic';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction to the Inner Critic') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction to the Inner Critic', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Identifying the Critical Voice') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Identifying the Critical Voice', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Origins of Self-Sabotage') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Origins of Self-Sabotage', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Patterns Recognition') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Patterns Recognition', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Reflection') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Reflection', 'video', 'both', false, 4, NOW(), NOW());
    END IF;

    -- M3: The 5 Types of Self Sabotage
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'The 5 Types of Self Sabotage') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'The 5 Types of Self Sabotage', 2, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'The 5 Types of Self Sabotage';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction to Self-Sabotage') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction to Self-Sabotage', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Procrastinator') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Procrastinator', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Perfectionist') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Perfectionist', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The People-Pleaser') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The People-Pleaser', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Avoider') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Avoider', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Self-Doubter and Integration') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Self-Doubter and Integration', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M4: From Critic to Coach
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'From Critic to Coach') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'From Critic to Coach', 3, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'From Critic to Coach';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction and Self-Talk') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction and Self-Talk', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Cognitive Reframing') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Cognitive Reframing', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Self-Compassion') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Self-Compassion', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Building Your Inner Coach') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Building Your Inner Coach', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Reflection') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Reflection', 'video', 'both', false, 4, NOW(), NOW());
    END IF;

    -- M5: Values Based Confidence
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Values Based Confidence') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Values Based Confidence', 4, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Values Based Confidence';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction to Values') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction to Values', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Discovering Your Core Values') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Discovering Your Core Values', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Living in Alignment') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Living in Alignment', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Living Your Values Daily') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Living Your Values Daily', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Integration') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Integration', 'video', 'both', false, 4, NOW(), NOW());
    END IF;

    -- M6: Building Self Trust
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Building Self Trust') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Building Self Trust', 5, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Building Self Trust';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Understanding Self-Trust') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Understanding Self-Trust', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'How Self-Trust Gets Broken') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'How Self-Trust Gets Broken', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Rebuilding Self-Trust') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Rebuilding Self-Trust', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Maintaining Self-Trust Long-Term') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Maintaining Self-Trust Long-Term', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Integration') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Integration', 'video', 'both', false, 4, NOW(), NOW());
    END IF;

    -- M7: Body Confidence From Within
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Body Confidence From Within') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Body Confidence From Within', 6, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Body Confidence From Within';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Mind-Body Connection') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Mind-Body Connection', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Transforming Body Criticism') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Transforming Body Criticism', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Embodiment Practices') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Embodiment Practices', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Body Acceptance and Daily Practices') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Body Acceptance and Daily Practices', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Integration') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Integration', 'video', 'both', false, 4, NOW(), NOW());
    END IF;

    -- M8: Social Confidence Essentials
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Social Confidence Essentials') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Social Confidence Essentials', 7, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Social Confidence Essentials';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Understanding Social Confidence') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Understanding Social Confidence', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Conversation Skills') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Conversation Skills', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Handling Social Challenges') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Handling Social Challenges', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Building Genuine Connections') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Building Genuine Connections', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Integration') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Integration', 'video', 'both', false, 4, NOW(), NOW());
    END IF;

    -- M9: Confidence Under Pressure
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Confidence Under Pressure') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Confidence Under Pressure', 8, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Confidence Under Pressure';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Understanding Pressure') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Understanding Pressure', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Pre-Event Preparation') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Pre-Event Preparation', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'In-the-Moment Techniques') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'In-the-Moment Techniques', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'High-Stakes Situations') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'High-Stakes Situations', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Recovery and Long-Term Growth') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Recovery and Long-Term Growth', 'video', 'both', false, 4, NOW(), NOW());
    END IF;

    -- M10: Living Confidently
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Living Confidently') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Living Confidently', 9, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Living Confidently';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Reviewing Your Journey') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Reviewing Your Journey', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Your Personal Confidence Profile') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Your Personal Confidence Profile', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Designing Your Daily Practice') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Designing Your Daily Practice', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Setting Meaningful Goals') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Setting Meaningful Goals', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Your Commitment to Confident Living') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Your Commitment to Confident Living', 'video', 'both', false, 4, NOW(), NOW());
    END IF;

  END IF; -- end C2

  -- ============================================================
  -- C3: Quit Your Imposter Syndrome
  -- ============================================================
  SELECT id INTO v_course_id FROM courses WHERE slug = 'quit-your-imposter-syndrome';
  IF v_course_id IS NOT NULL THEN

    -- M1: Understanding Imposter Syndrome
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Understanding Imposter Syndrome') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Understanding Imposter Syndrome', 0, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Understanding Imposter Syndrome';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Welcome and Introduction') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Welcome and Introduction', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'What Is Imposter Syndrome') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'What Is Imposter Syndrome', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Prevalence Paradox') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Prevalence Paradox', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Imposter Cycle') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Imposter Cycle', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 4, NOW(), NOW());
    END IF;

    -- M2: The 5 Imposter Types
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'The 5 Imposter Types') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'The 5 Imposter Types', 1, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'The 5 Imposter Types';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction to the Types') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction to the Types', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Perfectionist and The Expert') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Perfectionist and The Expert', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Natural Genius and The Soloist') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Natural Genius and The Soloist', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Superhero') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Superhero', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Identifying Your Type') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Identifying Your Type', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Application and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Application and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M3: Origins of Achievement Doubt
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Origins of Achievement Doubt') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Origins of Achievement Doubt', 2, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Origins of Achievement Doubt';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction Why Origins Matter') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction Why Origins Matter', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Family Messages and Dynamics') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Family Messages and Dynamics', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Early Experiences and Labels') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Early Experiences and Labels', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Cultural and Societal Factors') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Cultural and Societal Factors', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Connecting Past to Present') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Connecting Past to Present', 'video', 'both', false, 4, NOW(), NOW());
    END IF;

    -- M4: Rewriting the Internal Narrative
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Rewriting the Internal Narrative') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Rewriting the Internal Narrative', 3, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Rewriting the Internal Narrative';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction to Cognitive Reframing') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction to Cognitive Reframing', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Understanding Cognitive Distortions') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Understanding Cognitive Distortions', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Thought Challenging Process') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Thought Challenging Process', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Practicing Reframes') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Practicing Reframes', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Building New Patterns') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Building New Patterns', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Summary and Transition') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Summary and Transition', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M5: Building Your Evidence Portfolio
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Building Your Evidence Portfolio') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Building Your Evidence Portfolio', 4, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Building Your Evidence Portfolio';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction The Power of Evidence') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction The Power of Evidence', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Portfolio Components') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Portfolio Components', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Feedback Skills and Challenges') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Feedback Skills and Challenges', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Building and Using Your Portfolio') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Building and Using Your Portfolio', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Summary and Transition') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Summary and Transition', 'video', 'both', false, 4, NOW(), NOW());
    END IF;

    -- M6: The Comparison Trap
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'The Comparison Trap') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'The Comparison Trap', 5, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'The Comparison Trap';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Understanding the Comparison Trap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Understanding the Comparison Trap', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Where Comparison Shows Up') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Where Comparison Shows Up', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Breaking Free from Comparison') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Breaking Free from Comparison', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Practical Tools and Exercises') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Practical Tools and Exercises', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Summary and Transition') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Summary and Transition', 'video', 'both', false, 4, NOW(), NOW());
    END IF;

    -- M7: Perfectionism to Excellence
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Perfectionism to Excellence') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Perfectionism to Excellence', 6, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Perfectionism to Excellence';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Understanding Perfectionism') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Understanding Perfectionism', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Excellence vs Perfectionism') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Excellence vs Perfectionism', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Defining Good Enough') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Defining Good Enough', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Sustainable Standards') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Sustainable Standards', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Summary and Transition') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Summary and Transition', 'video', 'both', false, 4, NOW(), NOW());
    END IF;

    -- M8: Living Beyond Imposter Syndrome
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Living Beyond Imposter Syndrome') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Living Beyond Imposter Syndrome', 7, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Living Beyond Imposter Syndrome';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Looking Back and Looking Forward') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Looking Back and Looking Forward', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Your Personal Toolkit') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Your Personal Toolkit', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Support and Helping Others') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Support and Helping Others', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Maintenance and Commitment') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Maintenance and Commitment', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Closing and Celebration') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Closing and Celebration', 'video', 'both', false, 4, NOW(), NOW());
    END IF;

  END IF; -- end C3

  -- ============================================================
  -- C4: Stress To Strength
  -- ============================================================
  SELECT id INTO v_course_id FROM courses WHERE slug = 'stress-to-strength';
  IF v_course_id IS NOT NULL THEN

    -- M1: Understanding Stress and Anxiety
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Understanding Stress and Anxiety') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Understanding Stress and Anxiety', 0, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Understanding Stress and Anxiety';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Welcome and Introduction') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Welcome and Introduction', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Biology of Stress') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Biology of Stress', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Acute vs Chronic Stress') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Acute vs Chronic Stress', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Types of Anxiety and Feedback Loop') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Types of Anxiety and Feedback Loop', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Your Stress Signature and Exercises') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Your Stress Signature and Exercises', 'video', 'both', false, 4, NOW(), NOW());
    END IF;

    -- M2: Your Nervous System Explained
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Your Nervous System Explained') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Your Nervous System Explained', 1, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Your Nervous System Explained';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction and Autonomic Nervous System') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction and Autonomic Nervous System', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Polyvagal Theory Basics') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Polyvagal Theory Basics', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Four Fs') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Four Fs', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Your Window of Tolerance') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Your Window of Tolerance', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Principles of Regulation') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Principles of Regulation', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M3: Emergency Toolkit
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Emergency Toolkit') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Emergency Toolkit', 2, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Emergency Toolkit';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction and Bottom Up Regulation') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction and Bottom Up Regulation', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Breathing Techniques') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Breathing Techniques', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Grounding Techniques') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Grounding Techniques', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Temperature Movement Physical Techniques') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Temperature Movement Physical Techniques', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Building Your Toolkit and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Building Your Toolkit and Recap', 'video', 'both', false, 4, NOW(), NOW());
    END IF;

    -- M4: Cognitive Tools for Anxious Thoughts
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Cognitive Tools for Anxious Thoughts') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Cognitive Tools for Anxious Thoughts', 3, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Cognitive Tools for Anxious Thoughts';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction and CBT Model') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction and CBT Model', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Common Cognitive Distortions') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Common Cognitive Distortions', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The ABCDE Method') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The ABCDE Method', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Worry Postponement and Cognitive Defusion') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Worry Postponement and Cognitive Defusion', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 4, NOW(), NOW());
    END IF;

    -- M5: Breaking the Rumination Cycle
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Breaking the Rumination Cycle') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Breaking the Rumination Cycle', 4, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Breaking the Rumination Cycle';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Understanding Rumination') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Understanding Rumination', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Problem Solving vs Rumination') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Problem Solving vs Rumination', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Attention Redirection Techniques') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Attention Redirection Techniques', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Mindfulness and Behavioral Activation') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Mindfulness and Behavioral Activation', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 4, NOW(), NOW());
    END IF;

    -- M6: Lifestyle Foundations
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Lifestyle Foundations') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Lifestyle Foundations', 5, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Lifestyle Foundations';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction and Sleep') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction and Sleep', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Movement as Medicine') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Movement as Medicine', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Nutrition and Anxiety') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Nutrition and Anxiety', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Caffeine Alcohol and Digital Wellness') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Caffeine Alcohol and Digital Wellness', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 4, NOW(), NOW());
    END IF;

    -- M7: Building Resilience Mindset
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Building Resilience Mindset') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Building Resilience Mindset', 6, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Building Resilience Mindset';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Understanding True Resilience') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Understanding True Resilience', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Power of Mindset') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Power of Mindset', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Reframing Adversity') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Reframing Adversity', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Growth Mindset and PTG') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Growth Mindset and PTG', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 4, NOW(), NOW());
    END IF;

    -- M8: Emotional Regulation Under Pressure
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Emotional Regulation Under Pressure') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Emotional Regulation Under Pressure', 7, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Emotional Regulation Under Pressure';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Preparing for Anticipated Stress') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Preparing for Anticipated Stress', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Real Time Regulation') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Real Time Regulation', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Understanding Your Triggers') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Understanding Your Triggers', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Managing Difficult Emotions and Recovery') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Managing Difficult Emotions and Recovery', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 4, NOW(), NOW());
    END IF;

    -- M9: Your Support System
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Your Support System') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Your Support System', 8, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Your Support System';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Science of Social Support') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Science of Social Support', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Mapping Your Support Network') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Mapping Your Support Network', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Asking for Help Effectively') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Asking for Help Effectively', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Strengthening and Professional Support') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Strengthening and Professional Support', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 4, NOW(), NOW());
    END IF;

    -- M10: Your Personal Wellness Plan
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Your Personal Wellness Plan') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Your Personal Wellness Plan', 9, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Your Personal Wellness Plan';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Course Integration Review') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Course Integration Review', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Building Daily and Weekly Routines') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Building Daily and Weekly Routines', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Planning for Challenges') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Planning for Challenges', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Creating Your Personal Plan') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Creating Your Personal Plan', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Closing and Next Steps') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Closing and Next Steps', 'video', 'both', false, 4, NOW(), NOW());
    END IF;

  END IF; -- end C4

  -- ============================================================
  -- C5: The People Pleasing Cure
  -- ============================================================
  SELECT id INTO v_course_id FROM courses WHERE slug = 'the-people-pleasing-cure';
  IF v_course_id IS NOT NULL THEN

    -- M1: Understanding People Pleasing
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Understanding People Pleasing') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Understanding People Pleasing', 0, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Understanding People Pleasing';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction to People-Pleasing') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction to People-Pleasing', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Defining People-Pleasing') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Defining People-Pleasing', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Signs and Symptoms') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Signs and Symptoms', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Origins of People-Pleasing') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Origins of People-Pleasing', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Cost of People-Pleasing') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Cost of People-Pleasing', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Self-Assessment and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Self-Assessment and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M2: The Fawn Response
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'The Fawn Response') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'The Fawn Response', 1, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'The Fawn Response';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction and Survival Responses') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction and Survival Responses', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Freeze and Fawn') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Freeze and Fawn', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Polyvagal Theory Basics') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Polyvagal Theory Basics', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Recognizing Fawn in Yourself') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Recognizing Fawn in Yourself', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Beginning to Regulate') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Beginning to Regulate', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M3: Identifying Your Boundary Gaps
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Identifying Your Boundary Gaps') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Identifying Your Boundary Gaps', 2, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Identifying Your Boundary Gaps';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction to Boundary Gaps') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction to Boundary Gaps', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Energy Drains') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Energy Drains', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Domain Audit Work') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Domain Audit Work', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Domain Audit Personal') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Domain Audit Personal', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Creating Your Boundary Map') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Creating Your Boundary Map', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M4: The Art of Saying No
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'The Art of Saying No') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'The Art of Saying No', 3, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'The Art of Saying No';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction and Rights') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction and Rights', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Common Mistakes') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Common Mistakes', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Boundary Formula') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Boundary Formula', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Scripts and Examples') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Scripts and Examples', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Managing Discomfort') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Managing Discomfort', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M5: Workplace Boundaries
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Workplace Boundaries') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Workplace Boundaries', 4, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Workplace Boundaries';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction to Work Boundaries') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction to Work Boundaries', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Managing Workload') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Managing Workload', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Colleague Dynamics') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Colleague Dynamics', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Managing Up') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Managing Up', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Remote and Digital Boundaries') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Remote and Digital Boundaries', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M6: Boundaries in Close Relationships
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Boundaries in Close Relationships') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Boundaries in Close Relationships', 5, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Boundaries in Close Relationships';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction to Relationship Boundaries') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction to Relationship Boundaries', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Family of Origin Boundaries') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Family of Origin Boundaries', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Romantic Partnership Boundaries') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Romantic Partnership Boundaries', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Friendship Boundaries') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Friendship Boundaries', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Communicating Boundaries Lovingly') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Communicating Boundaries Lovingly', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M7: Handling Pushback
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Handling Pushback') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Handling Pushback', 6, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Handling Pushback';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction to Pushback') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction to Pushback', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Managing Guilt and Shame') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Managing Guilt and Shame', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Others Reactions') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Others Reactions', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Maintaining Under Pressure') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Maintaining Under Pressure', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Difficult People') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Difficult People', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M8: Building a Boundaried Life
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Building a Boundaried Life') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Building a Boundaried Life', 7, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Building a Boundaried Life';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction and Review') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction and Review', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Sustainable Self-Care') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Sustainable Self-Care', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Prevention Strategies') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Prevention Strategies', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Long Term Maintenance') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Long Term Maintenance', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Your Commitment') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Your Commitment', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Final Reflection') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Final Reflection', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

  END IF; -- end C5

  -- ============================================================
  -- C6: The Empowered Empath
  -- ============================================================
  SELECT id INTO v_course_id FROM courses WHERE slug = 'the-empowered-empath';
  IF v_course_id IS NOT NULL THEN

    -- M1: Discovering Your Empath Nature
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Discovering Your Empath Nature') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Discovering Your Empath Nature', 0, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Discovering Your Empath Nature';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Welcome and Introduction') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Welcome and Introduction', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'What Is an Empath') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'What Is an Empath', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The 5 Types of Empaths') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The 5 Types of Empaths', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Signs and Experiences') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Signs and Experiences', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Gifts and Challenges') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Gifts and Challenges', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Self-Assessment and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Self-Assessment and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M2: The Empaths Nervous System
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'The Empaths Nervous System') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'The Empaths Nervous System', 1, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'The Empaths Nervous System';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction and ANS Basics') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction and ANS Basics', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Polyvagal Theory Basics') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Polyvagal Theory Basics', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The HSP Nervous System') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The HSP Nervous System', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Window of Tolerance') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Window of Tolerance', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Foundational Regulation Practices') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Foundational Regulation Practices', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M3: Energy Awareness
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Energy Awareness') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Energy Awareness', 2, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Energy Awareness';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Yours vs Theirs') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Yours vs Theirs', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'How Energy Absorption Happens') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'How Energy Absorption Happens', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Signs of Energetic Overload') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Signs of Energetic Overload', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Energy Check-In') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Energy Check-In', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Common Absorption Patterns') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Common Absorption Patterns', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M4: Protecting Your Energy
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Protecting Your Energy') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Protecting Your Energy', 3, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Protecting Your Energy';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Grounding Fundamentals') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Grounding Fundamentals', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Shielding Techniques') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Shielding Techniques', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Energy Clearing Practices') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Energy Clearing Practices', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Environmental Protection') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Environmental Protection', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Daily Protection Routine') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Daily Protection Routine', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M5: Setting Energetic Boundaries
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Setting Energetic Boundaries') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Setting Energetic Boundaries', 4, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Setting Energetic Boundaries';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction to Energetic Boundaries') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction to Energetic Boundaries', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Types of Boundaries') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Types of Boundaries', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Communication Scripts') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Communication Scripts', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Handling Pushback and Guilt') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Handling Pushback and Guilt', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Boundaries with Specific People') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Boundaries with Specific People', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M6: Healing Empath Burnout
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Healing Empath Burnout') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Healing Empath Burnout', 5, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Healing Empath Burnout';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Understanding Burnout') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Understanding Burnout', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Recognizing the Signs') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Recognizing the Signs', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Physical Recovery') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Physical Recovery', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Emotional and Energetic Recovery') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Emotional and Energetic Recovery', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Building Sustainable Practices') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Building Sustainable Practices', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M7: Empaths in Relationships
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Empaths in Relationships') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Empaths in Relationships', 6, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Empaths in Relationships';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Empath Relationship Dynamics') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Empath Relationship Dynamics', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Maintaining Self in Partnership') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Maintaining Self in Partnership', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Communicating Your Sensitivity') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Communicating Your Sensitivity', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Compatible Partners for Empaths') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Compatible Partners for Empaths', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Navigating Conflict') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Navigating Conflict', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M8: Your Sensitivity as Strength
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Your Sensitivity as Strength') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Your Sensitivity as Strength', 7, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Your Sensitivity as Strength';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Reframing Sensitivity') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Reframing Sensitivity', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Empaths Unique Gifts') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Empaths Unique Gifts', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Using Your Abilities Purposefully') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Using Your Abilities Purposefully', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Empaths in the World') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Empaths in the World', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Your Empowered Empath Vision') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Your Empowered Empath Vision', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Final Reflection') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Final Reflection', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

  END IF; -- end C6

  -- ============================================================
  -- C7: Love Reset
  -- ============================================================
  SELECT id INTO v_course_id FROM courses WHERE slug = 'love-reset';
  IF v_course_id IS NOT NULL THEN

    -- M1: Your Relationship Foundation
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Your Relationship Foundation') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Your Relationship Foundation', 0, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Your Relationship Foundation';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Welcome and Introduction') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Welcome and Introduction', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Five Areas of Relationship Health') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Five Areas of Relationship Health', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Your Relationship History') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Your Relationship History', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Warning Signs and Strengths') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Warning Signs and Strengths', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Setting Intentions') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Setting Intentions', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M2: Communication Reset
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Communication Reset') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Communication Reset', 1, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Communication Reset';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction to Communication') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction to Communication', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Effective Speaking') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Effective Speaking', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Deep Listening') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Deep Listening', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Communication Killers') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Communication Killers', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Daily Communication Habits') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Daily Communication Habits', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M3: Rebuilding Emotional Intimacy
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Rebuilding Emotional Intimacy') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Rebuilding Emotional Intimacy', 2, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Rebuilding Emotional Intimacy';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction to Emotional Intimacy') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction to Emotional Intimacy', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Love Maps') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Love Maps', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Emotional Bids') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Emotional Bids', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Building Fondness and Admiration') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Building Fondness and Admiration', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Vulnerability and Trust') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Vulnerability and Trust', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M4: Navigating Conflict Constructively
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Navigating Conflict Constructively') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Navigating Conflict Constructively', 3, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Navigating Conflict Constructively';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Antidotes to Four Horsemen') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Antidotes to Four Horsemen', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'More Antidotes and Fair Fighting') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'More Antidotes and Fair Fighting', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Fair Fighting During') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Fair Fighting During', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'De-Escalation and Problems') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'De-Escalation and Problems', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Repair Attempts') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Repair Attempts', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M5: Rekindling Physical Intimacy
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Rekindling Physical Intimacy') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Rekindling Physical Intimacy', 4, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Rekindling Physical Intimacy';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction to Physical Intimacy') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction to Physical Intimacy', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Non-Sexual Physical Connection') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Non-Sexual Physical Connection', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Understanding Desire') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Understanding Desire', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Communication About Intimacy') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Communication About Intimacy', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Rekindling Strategies') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Rekindling Strategies', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M6: Creating Shared Meaning
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Creating Shared Meaning') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Creating Shared Meaning', 5, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Creating Shared Meaning';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction to Shared Meaning') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction to Shared Meaning', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Core Values Alignment') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Core Values Alignment', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Rituals of Connection') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Rituals of Connection', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Shared Goals and Dreams') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Shared Goals and Dreams', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Roles Identity and Culture') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Roles Identity and Culture', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M7: Managing External Stressors
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Managing External Stressors') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Managing External Stressors', 6, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Managing External Stressors';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction to External Stress') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction to External Stress', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Work Stress Management') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Work Stress Management', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Extended Family Management') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Extended Family Management', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Financial Stress Strategies') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Financial Stress Strategies', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Health and Transitions') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Health and Transitions', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Protective Factors and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Protective Factors and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M8: Your Relationship Action Plan
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Your Relationship Action Plan') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Your Relationship Action Plan', 7, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Your Relationship Action Plan';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Course Integration Review') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Course Integration Review', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Building Daily Practices') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Building Daily Practices', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Prevention and Maintenance') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Prevention and Maintenance', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Creating Your Plan') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Creating Your Plan', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Your Commitment') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Your Commitment', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Closing') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Closing', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M9: Transition to Parenthood (Bonus)
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Transition to Parenthood (Bonus)') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Transition to Parenthood (Bonus)', 8, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Transition to Parenthood (Bonus)';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction to Parenthood Transition') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction to Parenthood Transition', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Identity Shifts') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Identity Shifts', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Staying Partners') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Staying Partners', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Connection in Chaos') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Connection in Chaos', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Survival Strategies') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Survival Strategies', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M10: Communication When Exhausted (Bonus)
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Communication When Exhausted (Bonus)') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Communication When Exhausted (Bonus)', 9, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Communication When Exhausted (Bonus)';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction to Exhausted Communication') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction to Exhausted Communication', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Simplified Communication Tools') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Simplified Communication Tools', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Managing Conflict When Exhausted') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Managing Conflict When Exhausted', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Code Words and Shortcuts') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Code Words and Shortcuts', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Maintaining Connection') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Maintaining Connection', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M11: Division of Labor (Bonus)
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Division of Labor (Bonus)') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Division of Labor (Bonus)', 10, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Division of Labor (Bonus)';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction to Fair Division') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction to Fair Division', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Understanding the Load') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Understanding the Load', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Creating Fair Division') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Creating Fair Division', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Parenting Alignment') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Parenting Alignment', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Ongoing Adjustment') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Ongoing Adjustment', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

  END IF; -- end C7

  -- ============================================================
  -- C8: Thriving Through Teen Years
  -- ============================================================
  SELECT id INTO v_course_id FROM courses WHERE slug = 'thriving-through-teen-years';
  IF v_course_id IS NOT NULL THEN

    -- M1: Understanding Your Teenage Brain
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Understanding Your Teenage Brain') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Understanding Your Teenage Brain', 0, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Understanding Your Teenage Brain';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Welcome and Introduction') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Welcome and Introduction', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Your Brain Under Construction') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Your Brain Under Construction', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Emotional Brain') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Emotional Brain', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Risk Reward and Decisions') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Risk Reward and Decisions', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Sleep and Your Teen Brain') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Sleep and Your Teen Brain', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Adolescence as Opportunity') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Adolescence as Opportunity', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M2: Building Your Self Esteem Foundation
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Building Your Self Esteem Foundation') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Building Your Self Esteem Foundation', 1, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Building Your Self Esteem Foundation';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction to Self Esteem') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction to Self Esteem', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The External Traps') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The External Traps', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Why Teen Self Esteem Struggles') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Why Teen Self Esteem Struggles', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Building Blocks Part 1') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Building Blocks Part 1', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Building Blocks Part 2') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Building Blocks Part 2', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M3: Silencing the Inner Critic
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Silencing the Inner Critic') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Silencing the Inner Critic', 2, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Silencing the Inner Critic';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction to Inner Critic') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction to Inner Critic', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Recognizing the Critic') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Recognizing the Critic', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Impact of Self Criticism') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Impact of Self Criticism', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Challenging the Critic') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Challenging the Critic', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Building Your Inner Coach') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Building Your Inner Coach', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M4: Social Media and Self Worth
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Social Media and Self Worth') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Social Media and Self Worth', 3, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Social Media and Self Worth';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction to Social Media') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction to Social Media', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Comparison Machine') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Comparison Machine', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Your Personal Patterns') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Your Personal Patterns', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Digital Boundaries') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Digital Boundaries', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Intentional Connection') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Intentional Connection', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M5: Handling Peer Pressure
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Handling Peer Pressure') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Handling Peer Pressure', 4, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Handling Peer Pressure';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction to Peer Pressure') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction to Peer Pressure', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Positive vs Negative Influence') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Positive vs Negative Influence', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Knowing Your Values') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Knowing Your Values', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Response Strategies') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Response Strategies', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Finding Your People') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Finding Your People', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M6: Stress Anxiety and Overwhelm
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Stress Anxiety and Overwhelm') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Stress Anxiety and Overwhelm', 5, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Stress Anxiety and Overwhelm';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction to Stress') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction to Stress', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Anxiety Explained') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Anxiety Explained', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Immediate Relief Tools') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Immediate Relief Tools', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Managing Anxious Thoughts') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Managing Anxious Thoughts', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Lifestyle Foundations') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Lifestyle Foundations', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M7: Communication Skills
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Communication Skills') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Communication Skills', 6, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Communication Skills';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction to Communication') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction to Communication', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Expressing Yourself') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Expressing Yourself', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Listening Skills') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Listening Skills', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Assertive Communication') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Assertive Communication', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Difficult Conversations') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Difficult Conversations', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M8: Your Future Self
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Your Future Self') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Your Future Self', 7, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Your Future Self';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Introduction to Future Self') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Introduction to Future Self', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Values and Direction') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Values and Direction', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Goal Setting That Works') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Goal Setting That Works', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Breaking Goals into Action') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Breaking Goals into Action', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Obstacles and Resilience') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Obstacles and Resilience', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

  END IF; -- end C8

  -- ============================================================
  -- C9: Executive Presence
  -- ============================================================
  SELECT id INTO v_course_id FROM courses WHERE slug = 'executive-presence';
  IF v_course_id IS NOT NULL THEN

    -- M1: Understanding Executive Presence
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Understanding Executive Presence') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Understanding Executive Presence', 0, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Understanding Executive Presence';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Welcome and Introduction') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Welcome and Introduction', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Defining Executive Presence') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Defining Executive Presence', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Three Pillars Framework') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Three Pillars Framework', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Self Assessment') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Self Assessment', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Internal Barriers') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Internal Barriers', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M2: Confident Communication
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Confident Communication') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Confident Communication', 1, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Confident Communication';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Power of Clear Communication') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Power of Clear Communication', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Speaking with Authority') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Speaking with Authority', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Eliminating Undermining Habits') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Eliminating Undermining Habits', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Non Verbal Communication') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Non Verbal Communication', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Strategic Listening') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Strategic Listening', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M3: Owning the Room
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Owning the Room') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Owning the Room', 2, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Owning the Room';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Presentation Mindset') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Presentation Mindset', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Preparation That Builds Confidence') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Preparation That Builds Confidence', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Managing Nerves') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Managing Nerves', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Commanding the Room') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Commanding the Room', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Engaging Your Audience') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Engaging Your Audience', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M4: High Stakes Conversations
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'High Stakes Conversations') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'High Stakes Conversations', 3, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'High Stakes Conversations';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Understanding High Stakes Conversations') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Understanding High Stakes Conversations', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Preparation for Difficult Conversations') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Preparation for Difficult Conversations', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Delivering Difficult Messages') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Delivering Difficult Messages', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Staying Composed Under Pressure') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Staying Composed Under Pressure', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Handling Resistance and Emotion') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Handling Resistance and Emotion', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M5: Negotiating Your Worth
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Negotiating Your Worth') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Negotiating Your Worth', 4, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Negotiating Your Worth';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Negotiation Mindset') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Negotiation Mindset', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Knowing Your Worth') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Knowing Your Worth', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Negotiation Preparation') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Negotiation Preparation', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Salary Negotiation Techniques') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Salary Negotiation Techniques', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Beyond Salary') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Beyond Salary', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M6: Leading with Authenticity
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Leading with Authenticity') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Leading with Authenticity', 5, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Leading with Authenticity';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Authentic Leadership Defined') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Authentic Leadership Defined', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Your Leadership Values') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Your Leadership Values', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Your Unique Leadership Style') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Your Unique Leadership Style', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Avoiding Performance Mode') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Avoiding Performance Mode', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Vulnerability and Strength') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Vulnerability and Strength', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M7: Managing Up and Across
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Managing Up and Across') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Managing Up and Across', 6, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Managing Up and Across';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Art of Managing Up') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Art of Managing Up', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Building Manager Relationship') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Building Manager Relationship', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Influencing Without Authority') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Influencing Without Authority', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Peer Relationships') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Peer Relationships', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Navigating Politics') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Navigating Politics', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M8: Building Your Professional Brand
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Building Your Professional Brand') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Building Your Professional Brand', 7, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Building Your Professional Brand';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Understanding Professional Brand') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Understanding Professional Brand', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Defining Your Brand') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Defining Your Brand', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Visibility Strategies') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Visibility Strategies', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Building Your Network') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Building Your Network', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Reputation Management') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Reputation Management', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Exercises and Recap') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Exercises and Recap', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

  END IF; -- end C9

  -- ============================================================
  -- C10: Body Neutral
  -- ============================================================
  SELECT id INTO v_course_id FROM courses WHERE slug = 'body-neutral';
  IF v_course_id IS NOT NULL THEN

    -- M1: Understanding Body Image
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Understanding Body Image') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Understanding Body Image', 0, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Understanding Body Image';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Welcome and Introduction') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Welcome and Introduction', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Four Components') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Four Components', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'How Body Image Develops') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'How Body Image Develops', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Body Image Spectrum') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Body Image Spectrum', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Why Body Image Matters') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Why Body Image Matters', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Course Overview and Self Assessment') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Course Overview and Self Assessment', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M2: The Body Story
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'The Body Story') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'The Body Story', 1, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'The Body Story';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Your Body Has a History') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Your Body Has a History', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Early Body Messages') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Early Body Messages', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Key Moments and Turning Points') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Key Moments and Turning Points', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'External Influences') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'External Influences', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Beliefs Were Given Not Chosen') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Beliefs Were Given Not Chosen', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Rewriting Your Story') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Rewriting Your Story', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M3: From Positive to Neutral
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'From Positive to Neutral') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'From Positive to Neutral', 2, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'From Positive to Neutral';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Body Positivity Movement') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Body Positivity Movement', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Why Positivity Can Feel Unachievable') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Why Positivity Can Feel Unachievable', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Body Neutrality as Alternative') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Body Neutrality as Alternative', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Practicing Neutrality') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Practicing Neutrality', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Permission to Not Love Your Body') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Permission to Not Love Your Body', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Your Neutrality Path') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Your Neutrality Path', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M4: Healing Body Shame
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Healing Body Shame') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Healing Body Shame', 3, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Healing Body Shame';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Understanding Body Shame') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Understanding Body Shame', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'The Impact of Body Shame') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'The Impact of Body Shame', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Self Compassion Foundation') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Self Compassion Foundation', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Releasing Judgment') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Releasing Judgment', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Trauma Informed Approach') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Trauma Informed Approach', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Building Body Safety') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Building Body Safety', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M5: Beyond Appearance
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Beyond Appearance') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Beyond Appearance', 4, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Beyond Appearance';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Shifting from Appearance to Function') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Shifting from Appearance to Function', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'What Your Body Does for You') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'What Your Body Does for You', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Body Gratitude Practice') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Body Gratitude Practice', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Reframing Body Parts') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Reframing Body Parts', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Movement for Joy') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Movement for Joy', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Living in Function') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Living in Function', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M6: Body Image in Relationships
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Body Image in Relationships') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Body Image in Relationships', 5, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Body Image in Relationships';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'How Body Image Affects Relationships') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'How Body Image Affects Relationships', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Intimacy and Vulnerability') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Intimacy and Vulnerability', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Communicating Your Needs') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Communicating Your Needs', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Partner Dynamics') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Partner Dynamics', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Presence Over Performance') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Presence Over Performance', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Building Intimacy Confidence') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Building Intimacy Confidence', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M7: Dressing for You
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Dressing for You') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Dressing for You', 6, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Dressing for You';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Clothing and Body Image') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Clothing and Body Image', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Releasing Size Attachment') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Releasing Size Attachment', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Dressing for Now') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Dressing for Now', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Comfort as Priority') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Comfort as Priority', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Style as Self Expression') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Style as Self Expression', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Practical Strategies') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Practical Strategies', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

    -- M8: Living in Your Body
    IF NOT EXISTS (SELECT 1 FROM modules WHERE "courseId" = v_course_id AND title = 'Living in Your Body') THEN
      INSERT INTO modules (id, "courseId", title, "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_course_id, 'Living in Your Body', 7, NOW(), NOW());
    END IF;
    SELECT id INTO v_module_id FROM modules WHERE "courseId" = v_course_id AND title = 'Living in Your Body';

    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'From Body Image to Embodiment') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'From Body Image to Embodiment', 'video', 'both', false, 0, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Embodiment Practices') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Embodiment Practices', 'video', 'both', false, 1, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Sensory Engagement') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Sensory Engagement', 'video', 'both', false, 2, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Your Body Peace Plan') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Your Body Peace Plan', 'video', 'both', false, 3, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'When Struggles Return') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'When Struggles Return', 'video', 'both', false, 4, NOW(), NOW());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM lectures WHERE "moduleId" = v_module_id AND title = 'Long Term Body Peace') THEN
      INSERT INTO lectures (id, "moduleId", title, "lectureType", context, "isPreview", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, v_module_id, 'Long Term Body Peace', 'video', 'both', false, 5, NOW(), NOW());
    END IF;

  END IF; -- end C10

END $$;
