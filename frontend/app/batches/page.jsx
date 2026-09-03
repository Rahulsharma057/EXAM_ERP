
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import Layout from '../../components/common/Layout';
import EntityManager from '../../components/org/EntityManager';
import { api } from '../../services/api';

export default function BatchesPage() {
  const router = useRouter();

  const [courses, setCourses] = useState([]);
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [coursesRes, userRes] = await Promise.all([
          api.getCoursesList(),
          api.getMe(),
        ]);

        setCourses(coursesRes?.data || []);
        setUserRole(userRes?.user?.role || '');
      } catch (error) {
        console.error('Failed to load batches page:', error);
      }
    };

    loadData();
  }, []);

  const allowedRoles = [
    'super_admin',
    'org_admin',
    'centre_admin',
  ];

  return (
    <Layout>
      <EntityManager
        title="Batches"
        entityType="batch"

        api={{
          getList: api.getBatchesList,
          create: api.createBatch,
          update: api.updateBatch,
          delete: api.deleteBatch,
        }}

        fields={[
          {
            name: 'name',
            label: 'Batch Name',
            required: true,
          },
          {
            name: 'code',
            label: 'Code',
            required: true,
          },
          {
            name: 'academicYear',
            label: 'Academic Year',
          },
          {
            name: 'startDate',
            label: 'Start Date',
            type: 'date',
          },
          {
            name: 'endDate',
            label: 'End Date',
            type: 'date',
          },
        ]}

        parentField="course"
        parentOptions={courses}
        parentLabel="Course"

        extraColumns={[
          {
            key: 'academicYear',
            label: 'Academic Year',
          },
          {
            key: 'startDate',
            label: 'Start Date',
          },
          {
            key: 'endDate',
            label: 'End Date',
          },
        ]}

        breadcrumbs={[
          {
            label: 'Dashboard',
            path: '/',
          },
          {
            label: 'Organisations',
            path: '/organisations',
          },
          {
            label: 'Centres',
            path: '/centres',
          },
          {
            label: 'Courses',
            path: '/courses',
          },
          {
            label: 'Batches',
            path: '/batches',
          },
        ]}

        /*
         * VIEW BATCH
         */
        showView={true}
        onView={(item) => {
          if (!item?._id) {
            console.error('Batch ID missing:', item);
            return;
          }

          router.push(`/batches/${item._id}`);
        }}

        canCreate={allowedRoles.includes(userRole)}
        canEdit={allowedRoles.includes(userRole)}
        canDelete={allowedRoles.includes(userRole)}
      />
    </Layout>
  );
}
