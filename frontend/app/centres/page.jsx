'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/common/Layout';
import EntityManager from '../../components/org/EntityManager';
import { api } from '../../services/api';

export default function CentresPage() {
  const router = useRouter();
  const [organisations, setOrganisations] = useState([]);
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    api.getOrganisations().then(res => setOrganisations(res.data));
    api.getMe().then(res => setUserRole(res.user?.role || ''));
  }, []);

  return (
    <Layout>
      <EntityManager
        title="Centres"
        entityType="centre"
        api={{
          getList: api.getCentresList,
          create: api.createCentre,
          update: api.updateCentre,
          delete: api.deleteCentre
        }}
        fields={[
          { name: 'name', label: 'Centre Name', required: true },
          { name: 'code', label: 'Code', required: true },
          { name: 'address', label: 'Address', multiline: true, rows: 2, fullWidth: true },
          { name: 'contactEmail', label: 'Contact Email' },
          { name: 'contactPhone', label: 'Contact Phone' }
        ]}
        parentField="organisation"
        parentOptions={organisations}
        parentLabel="Organisation"
        breadcrumbs={[
          { label: 'Dashboard', path: '/' },
          { label: 'Organisations', path: '/organisations' }
        ]}
        onView={(item) => router.push(`/centres/${item._id}`)}
        canCreate={['super_admin', 'org_admin'].includes(userRole)}
        canEdit={['super_admin', 'org_admin'].includes(userRole)}
        canDelete={['super_admin', 'org_admin'].includes(userRole)}
      />
    </Layout>
  );
}
