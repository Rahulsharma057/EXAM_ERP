'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/common/Layout';
import EntityManager from '../../components/org/EntityManager';
import { api } from '../../services/api';

export default function CoursesPage() {
  const router = useRouter();
  const [centres, setCentres] = useState([]);
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    api.getCentresList().then(res => setCentres(res.data));
    api.getMe().then(res => setUserRole(res.user?.role || ''));
  }, []);

  return (
    <Layout>
      <EntityManager
        title="Courses"
        entityType="course"
        api={{
          getList: api.getCoursesList,
          create: api.createCourse,
          update: api.updateCourse,
          delete: api.deleteCourse
        }}
        fields={[
          { name: 'name', label: 'Course Name', required: true },
          { name: 'code', label: 'Code', required: true },
          { name: 'description', label: 'Description', multiline: true, rows: 2, fullWidth: true },
          { name: 'duration', label: 'Duration' }
        ]}
        parentField="centre"
        parentOptions={centres}
        parentLabel="Centre"
        breadcrumbs={[
          { label: 'Dashboard', path: '/' },
          { label: 'Organisations', path: '/organisations' },
          { label: 'Centres', path: '/centres' }
        ]}
        onView={(item) => router.push(`/courses/${item._id}`)}
        canCreate={['super_admin', 'org_admin', 'centre_admin'].includes(userRole)}
        canEdit={['super_admin', 'org_admin', 'centre_admin'].includes(userRole)}
        canDelete={['super_admin', 'org_admin', 'centre_admin'].includes(userRole)}
      />
    </Layout>
  );
}
