import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookOpen, Plus, Trash2, Users, Eye } from "lucide-react";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

interface Class {
  id?: string;
  _id?: string;
  name?: string;
  title?: string;
  class_name?: string;
  subject?: string;
  description?: string;
  classCode?: string;
  class_code?: string;
  invite_link?: string;
  teacher?: {
    id?: string;
    _id?: string;
    username?: string;
    email?: string;
  };
  teacher_id?: string;
  students?: any[];
  students_count?: number;
  createdAt?: string;
}

interface Teacher {
  id?: string;
  _id?: string;
  username: string;
  email: string;
}

export default function ClassManagement() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);
  const [enrollmentFilter, setEnrollmentFilter] = useState<string>("all");

  const [newClass, setNewClass] = useState({
    name: "",
    subject: "",
    description: "",
    teacherId: "",
  });

  // Enroll student dialog state
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [enrollStudentId, setEnrollStudentId] = useState("");
  const [enrollTargetClassId, setEnrollTargetClassId] = useState("");

  useEffect(() => {
    fetchClasses();
    fetchTeachers();
  }, []);

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const response = await api.get("/admin/classes");
      const data = response.data.data || response.data;
      setClasses(data.classes || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to fetch classes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      const response = await api.get("/admin/users", { params: { role: "teacher" } });
      const data = response.data.data || response.data;
      // Normalize returned users so we always have `_id`, `username`, `email` fields
      const teacherList = (data.users || [])
        .filter((u: any) => u.role === 'teacher')
        .map((u: any) => ({ _id: u.id || u._id, username: u.username, email: u.email }));
      setTeachers(teacherList);
    } catch (error: any) {
      console.error("Failed to fetch teachers:", error);
    }
  };

  const createClass = async () => {
    try {
      if (!newClass.teacherId) {
        toast({ title: 'Error', description: 'Please assign a teacher to create a class', variant: 'destructive' });
        return;
      }

      const payload: any = { name: newClass.name, subject: newClass.subject, description: newClass.description, teacherId: newClass.teacherId };

      const response = await api.post("/admin/classes", payload);
      const resData = response.data?.data || response.data;
      const inviteLink = resData?.invite_link || resData?.class?.invite_link || null;

      toast({ title: "Success", description: "Class created successfully" });
      if (inviteLink) toast({ title: "Invite Link", description: inviteLink });

      setCreateDialogOpen(false);
      setNewClass({ name: "", subject: "", description: "", teacherId: "" });
      fetchClasses();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to create class",
        variant: "destructive",
      });
    }
  };

  // Filter and search logic
  const filteredClasses = classes.filter(classItem => {
    const className = (classItem.name || classItem.title || classItem.class_name || "").toLowerCase();
    const classSubject = (classItem.subject || "").toLowerCase();
    const teacherName = (classItem.teacher?.username || "").toLowerCase();
    const query = searchQuery.toLowerCase();

    // Search filter
    const matchesSearch = !query || className.includes(query) || classSubject.includes(query) || teacherName.includes(query);

    // Teacher filter
    const matchesTeacher = !selectedTeacher || String(classItem.teacher?.id || classItem.teacher?._id) === String(selectedTeacher);

    // Enrollment filter
    let matchesEnrollment = true;
    if (enrollmentFilter === "has-students") {
      matchesEnrollment = (classItem.students_count || classItem.students?.length || 0) > 0;
    } else if (enrollmentFilter === "no-students") {
      matchesEnrollment = (classItem.students_count || classItem.students?.length || 0) === 0;
    }

    return matchesSearch && matchesTeacher && matchesEnrollment;
  });

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedTeacher(null);
    setEnrollmentFilter("all");
  };

  const hasActiveFilters = searchQuery || selectedTeacher || enrollmentFilter !== "all";

  const deleteClass = async (classId: string) => {
    if (!confirm("Are you sure you want to delete this class?")) return;

    try {
      await api.delete(`/admin/classes/${classId}`);
      toast({ title: "Success", description: "Class deleted successfully" });
      fetchClasses();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete class",
        variant: "destructive",
      });
    }
  };

  return (
    <AdminLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Class Management</h1>
            <p className="text-muted-foreground mt-2">Manage all classes in the system</p>
          </div>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Search & Filter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {/* Search Input */}
              <div>
                <Label htmlFor="search" className="text-sm mb-2 block">Search</Label>
                <Input
                  id="search"
                  placeholder="Search by name, subject, or teacher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>

              {/* Teacher Filter */}
              <div>
                <Label htmlFor="teacher-filter" className="text-sm mb-2 block">Teacher</Label>
                <Select value={selectedTeacher || "all"} onValueChange={(v) => setSelectedTeacher(v === "all" ? null : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All teachers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All teachers</SelectItem>
                    {teachers.map((t) => (
                      <SelectItem key={t._id} value={String(t._id)}>
                        {t.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Enrollment Filter */}
              <div>
                <Label htmlFor="enrollment-filter" className="text-sm mb-2 block">Enrollment</Label>
                <Select value={enrollmentFilter} onValueChange={setEnrollmentFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All classes</SelectItem>
                    <SelectItem value="has-students">Has students</SelectItem>
                    <SelectItem value="no-students">No students</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="w-full"
              >
                Clear Filters
              </Button>
            )}

            {/* Results Count */}
            <div className="text-sm text-muted-foreground">
              Showing {filteredClasses.length} of {classes.length} classes
            </div>
          </CardContent>
        </Card>

        {/* Create Class Button */}
        <div className="flex justify-end mb-6">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Class
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Class</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Class Name</Label>
                  <Input
                    id="name"
                    value={newClass.name}
                    onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={newClass.subject}
                    onChange={(e) => setNewClass({ ...newClass, subject: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newClass.description}
                    onChange={(e) => setNewClass({ ...newClass, description: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="teacher">Assign Teacher</Label>
                  <Select value={newClass.teacherId} onValueChange={(value) => setNewClass({ ...newClass, teacherId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher._id} value={teacher._id}>
                          {teacher.username} ({teacher.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mt-1">Students can join this class using the invite link after creation.</p>
                </div>
                <Button onClick={createClass} className="w-full">Create Class</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
          <DialogContent>
              <DialogHeader>
                <DialogTitle>Enroll Student by ID</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="studentId">Student ID</Label>
                  <Input id="studentId" value={enrollStudentId} onChange={(e) => setEnrollStudentId(e.target.value)} placeholder="Enter student id (exact)" />
                  <p className="text-xs text-muted-foreground mt-1">Teachers and admins can enroll a student by their user id.</p>
                </div>
                <Button onClick={async () => {
                  try {
                    if (!enrollStudentId || !enrollTargetClassId) return toast({ title: 'Error', description: 'Student ID and class must be set', variant: 'destructive' });
                    await api.post(`/classes/${enrollTargetClassId}/enroll`, { studentId: enrollStudentId });
                    toast({ title: 'Success', description: 'Student enrolled successfully' });
                    setEnrollDialogOpen(false);
                    setEnrollStudentId('');
                    setEnrollTargetClassId('');
                    fetchClasses();
                  } catch (error: any) {
                    toast({ title: 'Error', description: error.response?.data?.message || 'Failed to enroll student', variant: 'destructive' });
                  }
                }} className="w-full">Enroll Student</Button>
              </div>
            </DialogContent>
          </Dialog>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            [...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-24 bg-muted" />
                <CardContent className="h-32 bg-muted/50" />
              </Card>
            ))
          ) : filteredClasses.length > 0 ? (
            filteredClasses.map((classItem) => (
              <Card key={classItem.id || classItem._id} className="border-border hover:shadow-lg transition-shadow">
                <CardHeader className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      <CardTitle className="text-lg">{classItem.name || classItem.title || classItem.class_name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate(`/admin/classes/${classItem.id || classItem._id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      {((currentUser?.role === 'admin') || (currentUser?.role === 'superadmin') || (currentUser?.role === 'teacher' && (String(classItem.teacher?._id || classItem.teacher?.id || classItem.teacher_id) === String(currentUser?._id || currentUser?.id)))) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setEnrollTargetClassId(classItem.id || classItem._id); setEnrollDialogOpen(true); }}
                        >
                          Enroll Student
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteClass(classItem.id || classItem._id)}
                        className="text-primary-foreground hover:bg-white/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm opacity-90">{classItem.subject}</p>
                </CardHeader>
                <CardContent className="pt-6 space-y-3">
                  <p className="text-sm text-muted-foreground">{classItem.description}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Teacher:</span>
                    <span className="font-medium">{classItem.teacher?.username || "N/A"}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Class Code:</span>
                    <span className="font-mono font-medium">{classItem.class_code || classItem.classCode}</span>
                  </div>
                  {classItem.invite_link && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Invite Link:</span>
                      <div className="flex items-center gap-2">
                        <a href={classItem.invite_link} target="_blank" rel="noreferrer" className="text-primary-foreground underline truncate max-w-xs">{classItem.invite_link}</a>
                        <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(classItem.invite_link); toast({ title: 'Copied', description: 'Invite link copied to clipboard' }); }}>
                          Copy
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {classItem.students_count || classItem.students?.length || 0} students enrolled
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="md:col-span-2 lg:col-span-3 py-12 text-center">
              <p className="text-muted-foreground">No classes found matching your filters.</p>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={handleClearFilters} className="mt-3">
                  Clear Filters
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
