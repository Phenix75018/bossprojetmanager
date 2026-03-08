
-- calendar_events: drop RESTRICTIVE, recreate as PERMISSIVE
DROP POLICY IF EXISTS "Users can create own events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can delete own events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can update own events" ON public.calendar_events;
DROP POLICY IF EXISTS "Users can view own events" ON public.calendar_events;

CREATE POLICY "Users can create own events" ON public.calendar_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own events" ON public.calendar_events FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own events" ON public.calendar_events FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own events" ON public.calendar_events FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- calendar_integrations
DROP POLICY IF EXISTS "Users can create own integrations" ON public.calendar_integrations;
DROP POLICY IF EXISTS "Users can delete own integrations" ON public.calendar_integrations;
DROP POLICY IF EXISTS "Users can update own integrations" ON public.calendar_integrations;
DROP POLICY IF EXISTS "Users can view own integrations" ON public.calendar_integrations;

CREATE POLICY "Users can create own integrations" ON public.calendar_integrations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own integrations" ON public.calendar_integrations FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own integrations" ON public.calendar_integrations FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own integrations" ON public.calendar_integrations FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- calendar_shares
DROP POLICY IF EXISTS "Users can manage own calendar share" ON public.calendar_shares;

CREATE POLICY "Users can manage own calendar share" ON public.calendar_shares FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- notification_preferences
DROP POLICY IF EXISTS "Users can insert own notification prefs" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can update own notification prefs" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can view own notification prefs" ON public.notification_preferences;

CREATE POLICY "Users can insert own notification prefs" ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notification prefs" ON public.notification_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own notification prefs" ON public.notification_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- phases
DROP POLICY IF EXISTS "Users can create phases in own projects" ON public.phases;
DROP POLICY IF EXISTS "Users can delete phases in own projects" ON public.phases;
DROP POLICY IF EXISTS "Users can update phases in own projects" ON public.phases;
DROP POLICY IF EXISTS "Users can view phases of own projects" ON public.phases;

CREATE POLICY "Users can create phases in own projects" ON public.phases FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = phases.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can delete phases in own projects" ON public.phases FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = phases.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can update phases in own projects" ON public.phases FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = phases.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can view phases of own projects" ON public.phases FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = phases.project_id AND projects.user_id = auth.uid()));

-- projects
DROP POLICY IF EXISTS "Users can create own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;

CREATE POLICY "Users can create own projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- recommendation_alternatives
DROP POLICY IF EXISTS "Users can create alternatives" ON public.recommendation_alternatives;
DROP POLICY IF EXISTS "Users can delete alternatives" ON public.recommendation_alternatives;
DROP POLICY IF EXISTS "Users can update alternatives" ON public.recommendation_alternatives;
DROP POLICY IF EXISTS "Users can view own alternatives" ON public.recommendation_alternatives;

CREATE POLICY "Users can create alternatives" ON public.recommendation_alternatives FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM team_recommendations tr JOIN projects p ON p.id = tr.project_id WHERE tr.id = recommendation_alternatives.recommendation_id AND p.user_id = auth.uid()));
CREATE POLICY "Users can delete alternatives" ON public.recommendation_alternatives FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM team_recommendations tr JOIN projects p ON p.id = tr.project_id WHERE tr.id = recommendation_alternatives.recommendation_id AND p.user_id = auth.uid()));
CREATE POLICY "Users can update alternatives" ON public.recommendation_alternatives FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM team_recommendations tr JOIN projects p ON p.id = tr.project_id WHERE tr.id = recommendation_alternatives.recommendation_id AND p.user_id = auth.uid()));
CREATE POLICY "Users can view own alternatives" ON public.recommendation_alternatives FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM team_recommendations tr JOIN projects p ON p.id = tr.project_id WHERE tr.id = recommendation_alternatives.recommendation_id AND p.user_id = auth.uid()));

-- sent_notifications
DROP POLICY IF EXISTS "Users can insert own sent notifications" ON public.sent_notifications;
DROP POLICY IF EXISTS "Users can view own sent notifications" ON public.sent_notifications;

CREATE POLICY "Users can insert own sent notifications" ON public.sent_notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own sent notifications" ON public.sent_notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- subtasks
DROP POLICY IF EXISTS "Users can create subtasks in own projects" ON public.subtasks;
DROP POLICY IF EXISTS "Users can delete subtasks in own projects" ON public.subtasks;
DROP POLICY IF EXISTS "Users can update subtasks in own projects" ON public.subtasks;
DROP POLICY IF EXISTS "Users can view subtasks of own projects" ON public.subtasks;

CREATE POLICY "Users can create subtasks in own projects" ON public.subtasks FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM tasks JOIN phases ON phases.id = tasks.phase_id JOIN projects ON projects.id = phases.project_id WHERE tasks.id = subtasks.task_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can delete subtasks in own projects" ON public.subtasks FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM tasks JOIN phases ON phases.id = tasks.phase_id JOIN projects ON projects.id = phases.project_id WHERE tasks.id = subtasks.task_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can update subtasks in own projects" ON public.subtasks FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM tasks JOIN phases ON phases.id = tasks.phase_id JOIN projects ON projects.id = phases.project_id WHERE tasks.id = subtasks.task_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can view subtasks of own projects" ON public.subtasks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM tasks JOIN phases ON phases.id = tasks.phase_id JOIN projects ON projects.id = phases.project_id WHERE tasks.id = subtasks.task_id AND projects.user_id = auth.uid()));

-- task_explanations
DROP POLICY IF EXISTS "Users can create own explanations" ON public.task_explanations;
DROP POLICY IF EXISTS "Users can delete own explanations" ON public.task_explanations;
DROP POLICY IF EXISTS "Users can update own explanations" ON public.task_explanations;
DROP POLICY IF EXISTS "Users can view own explanations" ON public.task_explanations;

CREATE POLICY "Users can create own explanations" ON public.task_explanations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own explanations" ON public.task_explanations FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own explanations" ON public.task_explanations FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own explanations" ON public.task_explanations FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- tasks
DROP POLICY IF EXISTS "Users can create tasks in own projects" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete tasks in own projects" ON public.tasks;
DROP POLICY IF EXISTS "Users can update tasks in own projects" ON public.tasks;
DROP POLICY IF EXISTS "Users can view tasks of own projects" ON public.tasks;

CREATE POLICY "Users can create tasks in own projects" ON public.tasks FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM phases JOIN projects ON projects.id = phases.project_id WHERE phases.id = tasks.phase_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can delete tasks in own projects" ON public.tasks FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM phases JOIN projects ON projects.id = phases.project_id WHERE phases.id = tasks.phase_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can update tasks in own projects" ON public.tasks FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM phases JOIN projects ON projects.id = phases.project_id WHERE phases.id = tasks.phase_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can view tasks of own projects" ON public.tasks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM phases JOIN projects ON projects.id = phases.project_id WHERE phases.id = tasks.phase_id AND projects.user_id = auth.uid()));

-- team_recommendations
DROP POLICY IF EXISTS "Users can create recommendations in own projects" ON public.team_recommendations;
DROP POLICY IF EXISTS "Users can delete recommendations in own projects" ON public.team_recommendations;
DROP POLICY IF EXISTS "Users can view own project recommendations" ON public.team_recommendations;

CREATE POLICY "Users can create recommendations in own projects" ON public.team_recommendations FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = team_recommendations.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can delete recommendations in own projects" ON public.team_recommendations FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = team_recommendations.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can view own project recommendations" ON public.team_recommendations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = team_recommendations.project_id AND projects.user_id = auth.uid()));
