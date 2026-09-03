'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/common/Layout';
import EntityManager from '../../components/org/EntityManager';
import { api } from '../../services/api';

export default function OrganisationsPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    api.getMe().then(res => setUserRole(res.user?.role || ''));
  }, []);

  return (
    <Layout>
      <EntityManager
        title="Organisations"
        entityType="organisation"
        api={{
          getList: api.getOrganisationsList,
          create: api.createOrganisation,
          update: api.updateOrganisation,
          delete: api.deleteOrganisation
        }}
        fields={[
          { name: 'name', label: 'Organisation Name', required: true },
          { name: 'code', label: 'Code', required: true },
          { name: 'description', label: 'Description', multiline: true, rows: 2, fullWidth: true },
          { name: 'address', label: 'Address', multiline: true, rows: 2, fullWidth: true },
          { name: 'contactEmail', label: 'Contact Email' },
          { name: 'contactPhone', label: 'Contact Phone' }
        ]}
        breadcrumbs={[{ label: 'Dashboard', path: '/' }]}
        onView={(item) => router.push(`/organisations/${item._id}`)}
        canCreate={['super_admin'].includes(userRole)}
        canEdit={['super_admin'].includes(userRole)}
        canDelete={['super_admin'].includes(userRole)}
      />
    </Layout>
  );
}
