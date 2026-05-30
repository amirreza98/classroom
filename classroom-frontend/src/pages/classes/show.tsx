import React, { useState } from 'react';
import { useShow, useList, useCreate, useDelete, useInvalidate, useNotification } from "@refinedev/core";
import { useNavigate } from 'react-router';
import { ClassDetails, Enrollment, User } from "@/types";
import { ShowView, ShowViewHeader } from '@/components/refine-ui/views/show-view';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdvancedImage } from "@cloudinary/react";
import { bannerPhoto } from '@/lib/cloudinary';
import { useSession } from '@/lib/auth-client';
import { Users, AlertTriangle, Trash2, UserPlus, Copy, Check, Search, Pencil } from 'lucide-react';

const Show = () => {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const canCollaborate = userRole === 'teacher' || userRole === 'admin';

  const { query } = useShow<ClassDetails>({ resource: 'classes' });
  const classDetails = query.data?.data;
  const { isLoading, isError } = query;
  const { open: notify } = useNotification();
  const invalidate = useInvalidate();

  const [enrollStudentId, setEnrollStudentId] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  const { mutate: createEnrollment } = useCreate();
  const { mutate: deleteEnrollment } = useDelete();
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isUnenrolling, setIsUnenrolling] = useState(false);

  const { query: enrollmentsQuery } = useList<Enrollment>({
    resource: 'enrollments',
    filters: classDetails ? [{ field: 'classId', operator: 'eq', value: classDetails.id }] : [],
    pagination: { pageSize: 100 },
    queryOptions: { enabled: !!classDetails },
  });

  const { query: studentsQuery } = useList<User>({
    resource: 'users',
    filters: [{ field: 'role', operator: 'eq', value: 'student' }],
    pagination: { pageSize: 200 },
  });

  const enrollments = enrollmentsQuery?.data?.data ?? [];
  const allStudents = studentsQuery?.data?.data ?? [];

  // Filter out already enrolled students
  const enrolledIds = new Set(enrollments.map(e => e.studentId));
  const availableStudents = allStudents.filter(s => !enrolledIds.has(s.id));

  const filteredEnrollments = enrollments.filter(e =>
    !studentSearch || e.student?.name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
    e.student?.email?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const capacityPercent = classDetails ? (enrollments.length / classDetails.capacity) * 100 : 0;
  const isNearFull = capacityPercent >= 80;
  const isFull = capacityPercent >= 100;

  if (isLoading || isError || !classDetails) {
    return (
      <ShowView className="class-view class-show">
        <ShowViewHeader resource="classes" title="Class Details" />
        <p className="state-message">
          {isLoading ? 'Loading class details ...' : isError ? 'Failed to load class details...' : 'Class details not found'}
        </p>
      </ShowView>
    );
  }

  const teacherName = classDetails.teacher?.name ?? 'Unknown';
  const teachersInitials = teacherName.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');
  const placeholderUrl = `https://placehold.co/600x400?text=${encodeURIComponent(teachersInitials || 'NA')}`;
  const { name, description, status, capacity, bannerUrl, bannerCldPubId, subject, teacher, department, inviteCode } = classDetails;

  const handleCopyCode = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleEnroll = () => {
    const sid = selectedStudent || enrollStudentId.trim();
    if (!sid) return;

    setIsEnrolling(true);
    createEnrollment(
      { resource: 'enrollments', values: { classId: classDetails.id, studentId: sid } },
      {
        onSuccess: () => {
          setSelectedStudent('');
          setEnrollStudentId('');
          invalidate({ resource: 'enrollments', invalidates: ['list'] });
          notify?.({ type: 'success', message: 'Student enrolled successfully' });
          setIsEnrolling(false);
        },
        onError: (error: any) => {
          notify?.({ type: 'error', message: error?.message ?? 'Failed to enroll student' });
          setIsEnrolling(false);
        }
      }
    );
  };

  const handleUnenroll = (enrollmentId: number) => {
    setIsUnenrolling(true);
    deleteEnrollment(
      { resource: 'enrollments', id: enrollmentId },
      {
        onSuccess: () => {
          invalidate({ resource: 'enrollments', invalidates: ['list'] });
          notify?.({ type: 'success', message: 'Student unenrolled successfully' });
          setIsUnenrolling(false);
        },
        onError: (error: any) => {
          notify?.({ type: 'error', message: error?.message ?? 'Failed to unenroll student' });
          setIsUnenrolling(false);
        }
      }
    );
  };

  return (
    <ShowView className="class-view class-show">
      <ShowViewHeader resource="classes" title="Class Details" />

      <div className="banner">
        {bannerCldPubId ? (
          <AdvancedImage alt="Class Banner" cldImg={bannerPhoto(bannerCldPubId, name)} />
        ) : bannerUrl ? (
          <img src={bannerUrl} alt="Class Banner" className="w-full h-full object-cover" />
        ) : (
          <div className="placeholder" />
        )}
      </div>

      <Card className="details-card">
        <div className="details-header">
          <div>
            <h1>{name}</h1>
            <p>{description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{enrollments.length}/{capacity} students</Badge>
            {isNearFull && !isFull && <Badge variant="outline" className="border-orange-500 text-orange-500"><AlertTriangle className="h-3 w-3 mr-1" />Near Full</Badge>}
            {isFull && <Badge variant="destructive">Full</Badge>}
            <Badge variant={status === 'active' ? 'default' : 'secondary'} data-status={status}>{status.toUpperCase()}</Badge>
            {canCollaborate && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/classes/${classDetails.id}/collaborate`)} className="flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                Open Collaboration
              </Button>
            )}
          </div>
        </div>

        <div className="details-grid">
          <div className="instructor">
            <p>Instructor</p>
            <div>
              <img src={teacher?.image ?? placeholderUrl} alt={teacherName} />
              <div>
                <p>{teacherName}</p>
                <p>{teacher?.email}</p>
              </div>
            </div>
          </div>
          <div className="department">
            <p>Department</p>
            <div>
              <p>{department?.name}</p>
              <p>{department?.description}</p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="subject">
          <p>Subject</p>
          <div>
            <Badge variant="outline">Code: {subject?.code}</Badge>
            <p>{subject?.name}</p>
            <p>{subject?.description}</p>
          </div>
        </div>

        <Separator />

        {/* Invite Code */}
        <div className="join">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2>Invite Code</h2>
            {inviteCode && (
              <Button variant="outline" size="sm" onClick={handleCopyCode} className="flex items-center gap-2">
                {copiedCode ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                <span className="font-mono font-bold text-lg tracking-widest">{inviteCode}</span>
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">Share this code with students to let them join the class.</p>
        </div>

        <Separator />

        {/* Enrollments Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Enrolled Students ({enrollments.length}/{capacity})
            </h2>
          </div>

          {/* Capacity Warning */}
          {isNearFull && (
            <div className={`flex items-center gap-2 p-3 rounded-md mb-4 text-sm ${isFull ? 'bg-destructive/10 text-destructive' : 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'}`}>
              <AlertTriangle className="h-4 w-4" />
              {isFull ? 'This class has reached full capacity.' : `Class is ${Math.round(capacityPercent)}% full. Consider increasing capacity.`}
            </div>
          )}

          {/* Enroll Student */}
          {!isFull && (
            <Card className="mb-4 bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><UserPlus className="h-4 w-4" />Enroll a Student</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-2">
                  {availableStudents.length > 0 ? (
                    <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select a student..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableStudents.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name} ({s.email})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder="Enter student ID..."
                      value={enrollStudentId}
                      onChange={(e) => setEnrollStudentId(e.target.value)}
                      className="flex-1"
                    />
                  )}
                  <Button onClick={handleEnroll} disabled={isEnrolling || (!selectedStudent && !enrollStudentId.trim())} className="flex items-center gap-2">
                    {isEnrolling ? <><span>Enrolling...</span></> : <><UserPlus className="h-4 w-4" /><span>Enroll</span></>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Student Search */}
          {enrollments.length > 0 && (
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search enrolled students..." className="pl-10" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} />
            </div>
          )}

          {/* Enrolled Students List */}
          {enrollmentsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading enrollments...</p>
          ) : filteredEnrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{enrollments.length === 0 ? 'No students enrolled yet.' : 'No students match your search.'}</p>
          ) : (
            <div className="space-y-2">
              {filteredEnrollments.map((enrollment) => {
                const student = enrollment.student;
                const initials = student?.name?.split(' ').slice(0, 2).map(p => p[0]?.toUpperCase()).join('') ?? '?';
                return (
                  <div key={enrollment.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      {student?.image ? (
                        <img src={student.image} alt={student.name} className="h-9 w-9 rounded-full object-cover" />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">{initials}</div>
                      )}
                      <div>
                        <p className="text-sm font-medium">{student?.name ?? 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{student?.email ?? enrollment.studentId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {enrollment.createdAt && (
                        <span className="text-xs text-muted-foreground hidden sm:block">
                          Enrolled {new Date(enrollment.createdAt).toLocaleDateString()}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleUnenroll(enrollment.id)}
                        disabled={isUnenrolling}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </ShowView>
  );
};

export default Show;
