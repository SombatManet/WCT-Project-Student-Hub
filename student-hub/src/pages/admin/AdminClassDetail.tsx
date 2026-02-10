import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  BookOpen, 
  Users, 
  FileText, 
  Brain,
  Copy as CopyIcon,
  Check as CheckIcon,
  Mail,
  Calendar,
  Code
} from "lucide-react";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

interface ClassDetail {
  id: string;
  name?: string;
  title?: string;
  class_name?: string;
  subject?: string;
  description?: string;
  class_code?: string;
  invite_code?: string;
  invite_link?: string;
  teacher?: {
    id: string;
    username: string;
    email: string;
  };
  teacher_id?: string;
  students_count?: number;
  enrolled_student_ids?: string[];
  created_at?: string;
  updated_at?: string;
}

interface Student {
  id: string;
  username: string;
  email: string;
  avatar_url?: string | null;
  points?: number;
}

interface Assignment {
  id: string;
  title?: string;
  name?: string;
  created_at: string;
  submissions?: any[];
}

interface Quiz {
  id: string;
  title?: string;
  name?: string;
  created_at: string;
  submissions?: any[];
}

export default function AdminClassDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [classData, setClassData] = useState<ClassDetail | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  useEffect(() => {
    if (id) fetchClassData();
  }, [id]);

  const fetchClassData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      // Fetch class details
      const classResp = await api.get(`/admin/classes/${id}`);
      const cls = classResp.data.data?.class || classResp.data.data || classResp.data;
      setClassData(cls);

      // Fetch enrolled students
      if (cls.enrolled_student_ids && cls.enrolled_student_ids.length > 0) {
        const studentsResp = await api.get('/admin/users', { 
          params: { role: 'student' } 
        });
        const allStudents = studentsResp.data.data?.users || [];
        const enrolledStudents = allStudents.filter((s: Student) => 
          cls.enrolled_student_ids.includes(s.id)
        );
        setStudents(enrolledStudents);
      } else {
        setStudents([]);
      }

      // Fetch assignments for this class
      try {
        const assignResp = await api.get('/admin/assignments');
        const allAssignments = assignResp.data.data?.assignments || [];
        const classAssignments = allAssignments.filter((a: any) => 
          String(a.class_id) === String(id)
        );
        setAssignments(classAssignments);
      } catch (e) {
        setAssignments([]);
      }

      // Fetch quizzes for this class
      try {
        const quizResp = await api.get('/admin/quizzes');
        const allQuizzes = quizResp.data.data?.quizzes || [];
        const classQuizzes = allQuizzes.filter((q: any) => 
          String(q.class_id) === String(id)
        );
        setQuizzes(classQuizzes);
      } catch (e) {
        setQuizzes([]);
      }

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to load class details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string, type: 'code' | 'invite') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'code') {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 1500);
      } else {
        setCopiedInvite(true);
        setTimeout(() => setCopiedInvite(false), 1500);
      }
      toast({ title: 'Copied', description: `${type === 'code' ? 'Class code' : 'Invite link'} copied to clipboard.` });
    } catch (e) {
      toast({ title: 'Copy failed', description: 'Unable to copy', variant: 'destructive' });
    }
  };

  const initials = (name?: string) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    const first = parts[0]?.[0] || "";
    const second = parts.length > 1 ? parts[1]?.[0] || "" : "";
    return (first + second).toUpperCase() || name[0]?.toUpperCase() || "?";
  };

  const className = classData?.name || classData?.title || classData?.class_name || "Class";

  return (
    <AdminLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground">{className}</h1>
            <p className="text-muted-foreground mt-2">Complete class information and management</p>
          </div>
          <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
        </div>

        {loading ? (
          <div className="py-8 text-center">Loading...</div>
        ) : !classData ? (
          <div className="py-8 text-center text-muted-foreground">Class not found.</div>
        ) : (
          <>
            {/* Class Information */}
            <Card>
              <CardHeader>
                <CardTitle>Class Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Class Name</div>
                    <div className="text-lg font-semibold">{className}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Subject</div>
                    <div className="text-lg">{classData.subject || "—"}</div>
                  </div>
                  {classData.description && (
                    <div className="md:col-span-2">
                      <div className="text-sm text-muted-foreground mb-1">Description</div>
                      <div className="text-base">{classData.description}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Class Code</div>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-sm bg-muted px-2 py-1 rounded">
                        {classData.class_code || "—"}
                      </code>
                      {classData.class_code && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          onClick={() => handleCopy(classData.class_code!, 'code')}
                        >
                          {copiedCode ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Invite Code</div>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-sm bg-muted px-2 py-1 rounded">
                        {classData.invite_code || "—"}
                      </code>
                    </div>
                  </div>
                  {classData.invite_link && (
                    <div className="md:col-span-2">
                      <div className="text-sm text-muted-foreground mb-1">Invite Link</div>
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-sm bg-muted px-2 py-1 rounded break-all flex-1">
                          {classData.invite_link}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          onClick={() => handleCopy(classData.invite_link!, 'invite')}
                        >
                          {copiedInvite ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  )}
                  {classData.created_at && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Created</div>
                      <div className="text-sm">{new Date(classData.created_at).toLocaleString()}</div>
                    </div>
                  )}
                </div>

                {classData.teacher && (
                  <>
                    <Separator className="my-4" />
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Teacher</div>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>{initials(classData.teacher.username)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{classData.teacher.username}</div>
                          <div className="text-sm text-muted-foreground">{classData.teacher.email}</div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Statistics Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Students Enrolled</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{classData.students_count || students.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Assignments</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{assignments.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Quizzes</CardTitle>
                  <Brain className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{quizzes.length}</div>
                </CardContent>
              </Card>
            </div>

            {/* Student Roster */}
            <Card>
              <CardHeader>
                <CardTitle>Student Roster</CardTitle>
                <CardDescription>
                  {students.length} student{students.length !== 1 ? 's' : ''} enrolled
                </CardDescription>
              </CardHeader>
              <CardContent>
                {students.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-right">Points</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                {student.avatar_url ? (
                                  <AvatarImage 
                                    src={(student.avatar_url.startsWith('http') ? student.avatar_url : (api.defaults.baseURL?.replace(/\/api\/?$/, '') || '') + student.avatar_url)} 
                                    alt={student.username} 
                                  />
                                ) : (
                                  <AvatarFallback>{initials(student.username)}</AvatarFallback>
                                )}
                              </Avatar>
                              <span className="font-medium">{student.username}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{student.email}</TableCell>
                          <TableCell className="text-right font-semibold">{student.points || 0}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No students enrolled yet
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Assignments */}
            <Card>
              <CardHeader>
                <CardTitle>Assignments</CardTitle>
                <CardDescription>
                  {assignments.length} assignment{assignments.length !== 1 ? 's' : ''} created
                </CardDescription>
              </CardHeader>
              <CardContent>
                {assignments.length > 0 ? (
                  <div className="space-y-3">
                    {assignments.map((assignment) => (
                      <div key={assignment.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{assignment.title || assignment.name || "Untitled"}</div>
                            <div className="text-sm text-muted-foreground">
                              Created {new Date(assignment.created_at).toLocaleDateString()} • 
                              {' '}{assignment.submissions?.length || 0} submission{assignment.submissions?.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No assignments created yet
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quizzes */}
            <Card>
              <CardHeader>
                <CardTitle>Quizzes</CardTitle>
                <CardDescription>
                  {quizzes.length} quiz{quizzes.length !== 1 ? 'zes' : ''} created
                </CardDescription>
              </CardHeader>
              <CardContent>
                {quizzes.length > 0 ? (
                  <div className="space-y-3">
                    {quizzes.map((quiz) => (
                      <div key={quiz.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <Brain className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{quiz.title || quiz.name || "Untitled"}</div>
                            <div className="text-sm text-muted-foreground">
                              Created {new Date(quiz.created_at).toLocaleDateString()} • 
                              {' '}{quiz.submissions?.length || 0} submission{quiz.submissions?.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No quizzes created yet
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
