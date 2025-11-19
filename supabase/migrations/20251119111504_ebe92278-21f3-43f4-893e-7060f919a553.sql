-- Drop the existing foreign key constraint
ALTER TABLE base_schedule 
DROP CONSTRAINT IF EXISTS fk_student;

-- Update all tables with the new class format
UPDATE base_schedule
SET student_id = REPLACE(student_id, '_ט''1', '_ט'' 1')
WHERE student_id LIKE '%_ט''1';

UPDATE schedule_overrides
SET student_id = REPLACE(student_id, '_ט''1', '_ט'' 1')
WHERE student_id LIKE '%_ט''1';

UPDATE reset_dates
SET student_id = REPLACE(student_id, '_ט''1', '_ט'' 1')
WHERE student_id LIKE '%_ט''1';

UPDATE students 
SET 
  class = 'ט'' 1',
  student_id = REPLACE(student_id, '_ט''1', '_ט'' 1')
WHERE grade = 'ט''' AND class = 'ט''1';

-- Recreate the foreign key constraint
ALTER TABLE base_schedule
ADD CONSTRAINT fk_student 
FOREIGN KEY (student_id) 
REFERENCES students(student_id) 
ON DELETE CASCADE;