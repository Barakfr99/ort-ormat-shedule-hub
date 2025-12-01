CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: update_reset_dates_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_reset_dates_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_schedule_overrides_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_schedule_overrides_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_students_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_students_updated_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: base_schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.base_schedule (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id text NOT NULL,
    day text NOT NULL,
    hour_number integer NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: reset_dates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reset_dates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id text NOT NULL,
    reset_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: schedule_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id text NOT NULL,
    date date NOT NULL,
    hour_number integer NOT NULL,
    override_text text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_permanent boolean DEFAULT false NOT NULL,
    CONSTRAINT schedule_overrides_hour_number_check CHECK (((hour_number >= 1) AND (hour_number <= 8)))
);


--
-- Name: students; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.students (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id text NOT NULL,
    name text NOT NULL,
    class text NOT NULL,
    grade text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: base_schedule base_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.base_schedule
    ADD CONSTRAINT base_schedule_pkey PRIMARY KEY (id);


--
-- Name: base_schedule base_schedule_student_id_day_hour_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.base_schedule
    ADD CONSTRAINT base_schedule_student_id_day_hour_number_key UNIQUE (student_id, day, hour_number);


--
-- Name: reset_dates reset_dates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reset_dates
    ADD CONSTRAINT reset_dates_pkey PRIMARY KEY (id);


--
-- Name: reset_dates reset_dates_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reset_dates
    ADD CONSTRAINT reset_dates_student_id_key UNIQUE (student_id);


--
-- Name: schedule_overrides schedule_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_overrides
    ADD CONSTRAINT schedule_overrides_pkey PRIMARY KEY (id);


--
-- Name: schedule_overrides schedule_overrides_student_id_date_hour_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_overrides
    ADD CONSTRAINT schedule_overrides_student_id_date_hour_number_key UNIQUE (student_id, date, hour_number);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- Name: students students_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_student_id_key UNIQUE (student_id);


--
-- Name: idx_base_schedule_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_base_schedule_day ON public.base_schedule USING btree (day);


--
-- Name: idx_base_schedule_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_base_schedule_student ON public.base_schedule USING btree (student_id);


--
-- Name: idx_reset_dates_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reset_dates_student ON public.reset_dates USING btree (student_id);


--
-- Name: idx_schedule_overrides_permanent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedule_overrides_permanent ON public.schedule_overrides USING btree (is_permanent) WHERE (is_permanent = true);


--
-- Name: idx_schedule_overrides_student_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedule_overrides_student_date ON public.schedule_overrides USING btree (student_id, date);


--
-- Name: idx_students_class; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_class ON public.students USING btree (class);


--
-- Name: idx_students_grade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_grade ON public.students USING btree (grade);


--
-- Name: reset_dates update_reset_dates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_reset_dates_updated_at BEFORE UPDATE ON public.reset_dates FOR EACH ROW EXECUTE FUNCTION public.update_reset_dates_updated_at();


--
-- Name: schedule_overrides update_schedule_overrides_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_schedule_overrides_updated_at BEFORE UPDATE ON public.schedule_overrides FOR EACH ROW EXECUTE FUNCTION public.update_schedule_overrides_updated_at();


--
-- Name: students update_students_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_students_updated_at();


--
-- Name: base_schedule fk_student; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.base_schedule
    ADD CONSTRAINT fk_student FOREIGN KEY (student_id) REFERENCES public.students(student_id) ON DELETE CASCADE;


--
-- Name: base_schedule Anyone can delete base schedule; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can delete base schedule" ON public.base_schedule FOR DELETE USING (true);


--
-- Name: reset_dates Anyone can delete reset dates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can delete reset dates" ON public.reset_dates FOR DELETE USING (true);


--
-- Name: schedule_overrides Anyone can delete schedule overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can delete schedule overrides" ON public.schedule_overrides FOR DELETE USING (true);


--
-- Name: students Anyone can delete students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can delete students" ON public.students FOR DELETE USING (true);


--
-- Name: base_schedule Anyone can insert base schedule; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert base schedule" ON public.base_schedule FOR INSERT WITH CHECK (true);


--
-- Name: reset_dates Anyone can insert reset dates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert reset dates" ON public.reset_dates FOR INSERT WITH CHECK (true);


--
-- Name: schedule_overrides Anyone can insert schedule overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert schedule overrides" ON public.schedule_overrides FOR INSERT WITH CHECK (true);


--
-- Name: students Anyone can insert students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert students" ON public.students FOR INSERT WITH CHECK (true);


--
-- Name: base_schedule Anyone can update base schedule; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update base schedule" ON public.base_schedule FOR UPDATE USING (true);


--
-- Name: reset_dates Anyone can update reset dates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update reset dates" ON public.reset_dates FOR UPDATE USING (true);


--
-- Name: schedule_overrides Anyone can update schedule overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update schedule overrides" ON public.schedule_overrides FOR UPDATE USING (true);


--
-- Name: students Anyone can update students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can update students" ON public.students FOR UPDATE USING (true);


--
-- Name: base_schedule Anyone can view base schedule; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view base schedule" ON public.base_schedule FOR SELECT USING (true);


--
-- Name: reset_dates Anyone can view reset dates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view reset dates" ON public.reset_dates FOR SELECT USING (true);


--
-- Name: schedule_overrides Anyone can view schedule overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view schedule overrides" ON public.schedule_overrides FOR SELECT USING (true);


--
-- Name: students Anyone can view students; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view students" ON public.students FOR SELECT USING (true);


--
-- Name: base_schedule; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.base_schedule ENABLE ROW LEVEL SECURITY;

--
-- Name: reset_dates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reset_dates ENABLE ROW LEVEL SECURITY;

--
-- Name: schedule_overrides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.schedule_overrides ENABLE ROW LEVEL SECURITY;

--
-- Name: students; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


