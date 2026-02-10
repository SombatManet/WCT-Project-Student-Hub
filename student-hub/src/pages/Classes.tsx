import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";
import { Plus, Users, BookOpen, Loader2, Copy, Trash2, UserX, Eye, Settings, LogOut, MoreVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Student {
  _id: string;
  username: string;
  email: string;
}

interface Class {
  id?: string;
  _id?: string;
  name?: string;
  title?: string;
  subject: string;
  description: string;
  teacher?: {
    _id?: string;
    id?: string;
    username: string;
    email: string;
  };
  teacher_id?: string;
  classCode?: string;
  class_code?: string;
  students?: Student[];
  invite_code?: string;
  invite_link?: string;
}

export default function Classes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [classDetailOpen, setClassDetailOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [removeStudentLoading, setRemoveStudentLoading] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    description: "",
  });

  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const response = await api.get("/classes");
      setClasses(response.data.data.classes);
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

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      await api.post("/classes", formData);
      toast({
        title: "Success",
        description: "Class created successfully!",
      });
      setDialogOpen(false);
      setFormData({ name: "", subject: "", description: "" });
      fetchClasses();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to create class",
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
    }
  };

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      await api.post("/classes/join", { classCode: joinCode });
      toast({
        title: "Success",
        description: "Joined class successfully!",
      });
      setJoinDialogOpen(false);
      setJoinCode("");
      fetchClasses();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to join class",
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteClass = async (classId: string) => {
    if (!confirm("Are you sure you want to delete this class? This action cannot be undone.")) {
      return;
    }

    setDeleteLoading(classId);
    try {
      await api.delete(`/classes/${classId}`);
      toast({
        title: "Success",
        description: "Class deleted successfully!",
      });
      setClasses(prev => prev.filter(classItem => (classItem.id || classItem._id) !== classId));
      setClassDetailOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete class",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleRemoveStudent = async (classId: string, studentId: string, studentName: string) => {
    if (!confirm(`Are you sure you want to remove ${studentName} from this class?`)) {
      return;
    }

    setRemoveStudentLoading(studentId);
    try {
      await api.delete(`/classes/${classId}/students/${studentId}`);
      toast({
        title: "Success",
        description: "Student removed from class successfully!",
      });
      
      // Update the local state
      setClasses(prev => prev.map(classItem => {
        if ((classItem.id || classItem._id) === classId) {
          return {
            ...classItem,
            students: classItem.students.filter(student => student._id !== studentId)
          };
        }
        return classItem;
      }));

      // Update selected class if it's open
      if (selectedClass && (selectedClass.id || selectedClass._id) === classId) {
        setSelectedClass(prev => prev ? {
          ...prev,
          students: prev.students.filter(student => student._id !== studentId)
        } : null);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to remove student",
        variant: "destructive",
      });
    } finally {
      setRemoveStudentLoading(null);
    }
  };

  const handleLeaveClass = async (classId: string, className: string) => {
    if (!confirm(`Are you sure you want to leave ${className}?`)) {
      return;
    }

    try {
      await api.post(`/classes/${classId}/leave`);
      toast({
        title: "Success",
        description: "Successfully left the class!",
      });
      setClasses(prev => prev.filter(classItem => (classItem.id || classItem._id) !== classId));
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to leave class",
        variant: "destructive",
      });
    }
  };

  const copyClassCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied!",
      description: "Class code copied to clipboard",
    });
  };

  const copyInviteLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({
      title: "Copied!",
      description: "Invite link copied to clipboard",
    });
  };

  const viewClassDetails = async (classItem: Class) => {
    try {
      const classId = classItem.id || classItem._id;
      if (!classId) {
        throw new Error('Class ID is missing');
      }
      const response = await api.get(`/classes/${classId}`);
      setSelectedClass(response.data.data.class);
      setClassDetailOpen(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to load class details",
        variant: "destructive",
      });
    }
  };

  const isClassOwner = (classItem: Class) => {
    const teacherId = classItem.teacher?.id || classItem.teacher?._id || classItem.teacher_id;
    const userId = user?.id;
    return user?.role === 'teacher' && teacherId === userId;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Classes</h1>
            <p className="text-muted-foreground">
              {user?.role === "student" ? "Your enrolled classes" : "Manage your classes"}
            </p>
          </div>

          {user?.role === "teacher" || user?.role === "admin" ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Class
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Class</DialogTitle>
                  <DialogDescription>Add a new class for students to join</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateClass} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Class Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Mathematics 101"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      placeholder="Mathematics"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Class description..."
                      rows={3}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={formLoading}>
                    {formLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Class"
                    )}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          ) : (
            <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Join Class
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Join a Class</DialogTitle>
                  <DialogDescription>Enter the class code provided by your teacher</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleJoinClass} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="classCode">Class Code</Label>
                    <Input
                      id="classCode"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder="ABC123"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={formLoading}>
                    {formLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      "Join Class"
                    )}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Classes Grid */}
        {classes.length === 0 ? (
          <Card className="shadow-md">
            <CardContent className="flex min-h-[300px] items-center justify-center">
              <div className="text-center">
                <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-lg font-medium">No classes yet</p>
                <p className="text-sm text-muted-foreground">
                  {user?.role === "student"
                    ? "Join a class to get started"
                    : "Create a class to get started"}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((classItem) => (
              <Card key={classItem.id || classItem._id} className="transition-all hover:shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="mb-1">{classItem.name || classItem.title}</CardTitle>
                      <CardDescription>{classItem.subject}</CardDescription>
                    </div>
                    
                    {/* Action menu for teachers */}
                    {(user?.role === "teacher" || user?.role === "admin") && isClassOwner(classItem) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => viewClassDetails(classItem)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copyClassCode(classItem.classCode)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Class Code
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteClass(classItem.id || classItem._id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Class
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {classItem.description || "No description available"}
                  </p>
                  
                  <div className="flex items-center justify-between border-t pt-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      {(classItem.students ? classItem.students.length : (classItem as any).students_count || 0)} students
                    </div>
                    
                    {/* Class code display for teachers */}
                    {(user?.role === "teacher" || user?.role === "admin") && (
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            Code: {classItem.classCode || classItem.class_code}
                          </Badge>
                          {(classItem.classCode || classItem.class_code) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyClassCode(classItem.classCode || classItem.class_code)}
                              className="h-6 w-6 p-0"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        {classItem.invite_link && (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs max-w-[220px] truncate">
                              Invite: {classItem.invite_link}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyInviteLink(classItem.invite_link!)}
                              className="h-6 w-6 p-0"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                              <a href={classItem.invite_link} target="_blank" rel="noreferrer">Open</a>
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {classItem.teacher && (
                    <p className="text-xs text-muted-foreground">
                      Teacher: {classItem.teacher.username}
                    </p>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    {user?.role === "student" ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewClassDetails(classItem)}
                          className="flex-1 gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          View Details
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLeaveClass(classItem.id || classItem._id, classItem.name || classItem.title || "Class")}
                          className="gap-2"
                        >
                          <LogOut className="h-4 w-4" />
                          Leave
                        </Button>
                      </>
                    ) : (
                      // Teacher actions - always show manage button
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => viewClassDetails(classItem)}
                        className="w-full gap-2"
                      >
                        <Settings className="h-4 w-4" />
                        Manage Class
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Class Details Dialog for Teachers */}
        <Dialog open={classDetailOpen} onOpenChange={setClassDetailOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {user?.role === 'student' ? 'Class Overview' : 'Manage Class'} - {selectedClass?.name || selectedClass?.title}
              </DialogTitle>
              <DialogDescription>
                {user?.role === 'student' 
                  ? 'View class information and resources'
                  : 'View and manage students in this class'
                }
              </DialogDescription>
            </DialogHeader>
            {selectedClass && (
              <div className="space-y-6">
                {/* Class Information */}
                <div className="grid gap-4 md:grid-cols-2 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <Label className="font-semibold">Class Name</Label>
                    <p className="text-lg">{selectedClass.name || selectedClass.title || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="font-semibold">Subject</Label>
                    <p className="text-lg">{selectedClass.subject || 'N/A'}</p>
                  </div>
                  
                  {/* For Teachers - Show class code */}
                  {user?.role !== 'student' && (
                    <>
                      <div>
                        <Label className="font-semibold">Class Code</Label>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-lg px-3 py-1">
                            {selectedClass.classCode || selectedClass.class_code || 'N/A'}
                          </Badge>
                          {(selectedClass.classCode || selectedClass.class_code) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyClassCode(selectedClass.classCode || selectedClass.class_code)}
                              className="gap-2"
                            >
                              <Copy className="h-4 w-4" />
                              Copy
                            </Button>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label className="font-semibold">Invite Link</Label>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-sm px-3 py-1 max-w-[320px] truncate">
                            {selectedClass.invite_link || 'N/A'}
                          </Badge>
                          {selectedClass.invite_link && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyInviteLink(selectedClass.invite_link!)}
                                className="gap-2"
                              >
                                <Copy className="h-4 w-4" />
                                Copy
                              </Button>
                              <Button variant="outline" size="sm" asChild>
                                <a href={selectedClass.invite_link} target="_blank" rel="noreferrer">Open</a>
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                  
                  {/* For Students - Show teacher info */}
                  {user?.role === 'student' && selectedClass.teacher && (
                    <div>
                      <Label className="font-semibold">Teacher</Label>
                      <p className="text-lg">{selectedClass.teacher.username}</p>
                      <p className="text-sm text-muted-foreground">{selectedClass.teacher.email}</p>
                    </div>
                  )}
                  
                  <div>
                    <Label className="font-semibold">Total Students</Label>
                    <p className="text-lg">{selectedClass.students?.length || 0} students</p>
                  </div>
                </div>

                {selectedClass.description && (
                  <div>
                    <Label className="font-semibold">Description</Label>
                    <p className="text-sm text-muted-foreground mt-1 p-2 bg-muted/30 rounded">
                      {selectedClass.description}
                    </p>
                  </div>
                )}

                {/* Quick Links for Students */}
                {user?.role === 'student' && (
                  <div className="grid gap-3 md:grid-cols-3">
                    <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                      <a href="/assignments">
                        <BookOpen className="h-6 w-6" />
                        <span className="font-semibold">Assignments</span>
                      </a>
                    </Button>
                    <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                      <a href="/quizzes">
                        <BookOpen className="h-6 w-6" />
                        <span className="font-semibold">Quizzes</span>
                      </a>
                    </Button>
                    <Button variant="outline" className="h-20 flex-col gap-2">
                      <Users className="h-6 w-6" />
                      <span className="font-semibold">Classmates</span>
                      <span className="text-xs text-muted-foreground">{selectedClass.students?.length || 0} students</span>
                    </Button>
                  </div>
                )}

                {/* Students Table - Show for both teachers and students */}
                {(user?.role !== 'student' || (selectedClass.students && selectedClass.students.length > 0)) && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <Label className="font-semibold text-lg">
                          {user?.role === 'student' ? 'Classmates' : 'Students'}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {user?.role === 'student' 
                            ? 'Students enrolled in this class'
                            : 'Manage students enrolled in this class'
                          }
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {selectedClass.students?.length || 0} enrolled
                      </Badge>
                    </div>
                    
                    {(selectedClass.students && selectedClass.students.length > 0) ? (
                      <div className="border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Student Name</TableHead>
                              <TableHead>Email</TableHead>
                              {user?.role !== 'student' && <TableHead className="w-[100px]">Actions</TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedClass.students.map((student) => (
                              <TableRow key={student._id}>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                      <Users className="h-4 w-4 text-primary" />
                                    </div>
                                    {student.username}
                                  </div>
                                </TableCell>
                                <TableCell>{student.email}</TableCell>
                                {user?.role !== 'student' && (
                                  <TableCell>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRemoveStudent(selectedClass._id, student._id, student.username)}
                                      disabled={removeStudentLoading === student._id}
                                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    >
                                      {removeStudentLoading === student._id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <UserX className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                        <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">No students enrolled yet</p>
                        {user?.role !== 'student' && (
                          <>
                            <p className="text-sm mt-2">Share the class code with students to join</p>
                            <div className="mt-4 flex justify-center">
                              <Button
                                variant="outline"
                                onClick={() => copyClassCode(selectedClass.classCode || selectedClass.class_code)}
                                className="gap-2"
                              >
                                <Copy className="h-4 w-4" />
                                Copy Class Code
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Danger Zone for Teachers */}
                {user?.role !== 'student' && (
                  <div className="border border-destructive/50 rounded-lg p-4 bg-destructive/5">
                    <h4 className="font-semibold text-destructive mb-2">Danger Zone</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Once you delete a class, there is no going back. This will remove all students and class data.
                    </p>
                    <Button
                      variant="destructive"
                      onClick={() => handleDeleteClass(selectedClass.id || selectedClass._id)}
                      disabled={deleteLoading === (selectedClass.id || selectedClass._id)}
                    >
                      {deleteLoading === (selectedClass.id || selectedClass._id) ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Deleting Class...
                        </>
                      ) : (
                        <>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete This Class
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}