-- Remove EcoVadis certification framework and all related data

-- Delete any audit packages for EcoVadis
DELETE FROM certification_audit_packages
WHERE framework_id IN (
  SELECT id FROM certification_frameworks WHERE framework_code = 'ecovadis'
);

-- Delete any evidence links for EcoVadis
DELETE FROM certification_evidence_links
WHERE framework_id IN (
  SELECT id FROM certification_frameworks WHERE framework_code = 'ecovadis'
);

-- Delete any gap analyses for EcoVadis requirements
DELETE FROM certification_gap_analyses
WHERE requirement_id IN (
  SELECT id FROM framework_requirements WHERE framework_id IN (
    SELECT id FROM certification_frameworks WHERE framework_code = 'ecovadis'
  )
);

-- Delete any organization certifications for EcoVadis
DELETE FROM organization_certifications
WHERE framework_id IN (
  SELECT id FROM certification_frameworks WHERE framework_code = 'ecovadis'
);

-- Delete any requirements for EcoVadis
DELETE FROM framework_requirements
WHERE framework_id IN (
  SELECT id FROM certification_frameworks WHERE framework_code = 'ecovadis'
);

-- Delete the EcoVadis framework itself
DELETE FROM certification_frameworks WHERE framework_code = 'ecovadis';
