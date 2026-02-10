import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";
import { Plus, FileText, Calendar, Award, Loader2, Upload, CheckCircle, Clock, Trash2, Download, Star, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Submission {
  _id: string;
  student: {
    _id: string;
    username: string;
    email: string;
  } | string;
  fileName: string;
  filePath: string;
  fileSize: number;
  submittedAt: string;
  grade?: number;
  feedback?: string;
  gradedAt?: string;
}

interface Assignment {
  id?: string;
  _id?: string;
  title: string;
  description: string;
  class: {
    id?: string;
    _id?: string;
    name: string;
  };
  teacher: {
    id?: string;
    _id?: string;
    username: string;
  } | string;
  dueDate: string;
  maxPoints: number;
  submissions?: Submission[];
  createdAt: string;
}

interface Class {
  id?: string;
  _id?: string;
  name: string;
}

export default function Assignments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false);
  const [submissionsDialogOpen, setSubmissionsDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    class: "",
    dueDate: "",
    maxPoints: 100,
  });

  const [gradeData, setGradeData] = useState({
    grade: 0,
    feedback: "",
  });

  useEffect(() => {
    fetchClasses();
    fetchAssignments();
  }, []);

  const fetchClasses = async () => {
    try {
      const response = await api.get("/classes");
      setClasses(response.data.data.classes);
    } catch (error: any) {
      console.error("Failed to fetch classes:", error);
      toast({
        title: "Error",
        description: "Failed to load classes",
        variant: "destructive",
      });
    }
  };

  const fetchAssignments = async () => {
    try {
      const response = await api.get("/classes");
      const allClasses = response.data.data.classes || [];
      
      if (allClasses.length === 0) {
        setAssignments([]);
        setLoading(false);
        return;
      }
      
      const assignmentsPromises = allClasses.map((classItem: any) =>
        api.get(`/assignments/class/${classItem.id || classItem._id}`).catch(() => ({ data: { data: { assignments: [] } } }))
      );
      
      const assignmentsResponses = await Promise.all(assignmentsPromises);
      const allAssignments = assignmentsResponses.flatMap(
        (response) => response.data?.data?.assignments || []
      );
      
      setAssignments(allAssignments);
    } catch (error: any) {
      console.error("Failed to fetch assignments:", error);
      toast({
        title: "Error",
        description: "Failed to load assignments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "File size must be less than 10MB",
          variant: "destructive",
        });
        return;
      }

      // Check file type
      const allowedTypes = ['.pdf', '.doc', '.docx', '.txt', '.zip', '.jpg', '.jpeg', '.png'];
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!allowedTypes.includes(fileExt)) {
        toast({
          title: "Error",
          description: "Please select a PDF, DOC, DOCX, TXT, ZIP, JPG, or PNG file",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
    }
  };



  const getStatus = (assignment: Assignment) => {
    const isOverdue = new Date(assignment.dueDate) < new Date();
    const submission = assignment.submissions?.find((sub: Submission) => {
      const studentId = typeof sub.student === 'object' ? sub.student._id : sub.student;
      return studentId === user?.id;
    });

    if (submission?.grade !== undefined) {
      return { 
        label: `Graded: ${submission.grade}/${assignment.maxPoints}`, 
        variant: "default" as const, 
        icon: CheckCircle 
      };
    }
    if (submission) {
      return { label: "Submitted", variant: "secondary" as const, icon: CheckCircle };
    }
    if (isOverdue) {
      return { label: "Overdue", variant: "destructive" as const, icon: Clock };
    }
    return { label: "Pending", variant: "secondary" as const, icon: Clock };
  };

  const getStudentName = (submission: Submission) => {
    if (typeof submission.student === 'object') {
      return submission.student.username;
    }
    return "Student";
  };

  const isAssignmentOwner = (assignment: Assignment) => {
    if (!user || user.role !== 'teacher') return false;
    const teacherId = typeof assignment.teacher === 'object' ? assignment.teacher._id : assignment.teacher;
    return teacherId === user.id;
  };

  const getUserSubmission = (assignment: Assignment) => {
    if (!user) return null;
    return assignment.submissions?.find((sub: Submission) => {
      const studentId = typeof sub.student === 'object' ? sub.student._id : sub.student;
      return studentId === user.id;
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const downloadFile = async (submission: Submission) => {
    try {
      const downloadUrl = `/api/assignments/files/${submission.filePath}`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', submission.fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  const renderStudentSubmissionInfo = (assignment: Assignment) => {
    const userSubmission = getUserSubmission(assignment);
    
    if (!userSubmission) return null;

    return (
      <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
        <h4 className="font-semibold mb-2">Your Submission</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">File: </span>
            <span>{userSubmission.fileName}</span>
          </div>
          <div>
            <span className="font-medium">Size: </span>
            <span>{formatFileSize(userSubmission.fileSize)}</span>
          </div>
          <div>
            <span className="font-medium">Submitted: </span>
            <span>{new Date(userSubmission.submittedAt).toLocaleString()}</span>
          </div>
          {userSubmission.grade !== undefined && (
            <div>
              <span className="font-medium">Grade: </span>
              <Badge variant="default">
                {userSubmission.grade}/{assignment.maxPoints}
              </Badge>
            </div>
          )}
        </div>
        
        {userSubmission.feedback && (
          <div className="mt-3">
            <span className="font-medium">Teacher Feedback: </span>
            <p className="text-sm text-muted-foreground mt-1 bg-white p-2 rounded border">
              {userSubmission.feedback}
            </p>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadFile(userSubmission)}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download Submission
          </Button>
        </div>
      </div>
    );
  };

  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment || !selectedFile) return;
    setFormLoading(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const assignmentId = selectedAssignment.id || selectedAssignment._id;
      if (!assignmentId) throw new Error('Assignment ID missing');
      const response = await api.post(`/assignments/${assignmentId}/submit`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = (progressEvent.loaded / progressEvent.total) * 100;
            setUploadProgress(Math.round(progress));
          }
        },
      });

      toast({
        title: "Success",
        description: "Assignment submitted successfully!",
      });
      setSubmitDialogOpen(false);
      setSelectedFile(null);
      setSelectedAssignment(null);
      fetchAssignments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to submit assignment",
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm("Are you sure you want to delete this assignment? This action cannot be undone.")) {
      return;
    }

    setDeleteLoading(assignmentId);
    try {
      await api.delete(`/assignments/${assignmentId}`);
      
      toast({
        title: "Success",
        description: "Assignment deleted successfully!",
      });
      
      setAssignments(prev => prev.filter(assignment => (assignment.id || assignment._id) !== assignmentId));
    } catch (error: any) {
      console.error("Delete assignment error:", error);
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete assignment",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(null);
    }
  }

  const handleGradeAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment || !selectedSubmission) return;

    setFormLoading(true);
    try {
      await api.post(`/assignments/${selectedAssignment.id || selectedAssignment._id}/grade`, {
        submissionId: selectedSubmission._id,
        grade: gradeData.grade,
        feedback: gradeData.feedback,
      });
      toast({
        title: "Success",
        description: "Grade submitted successfully!",
      });
      setGradeDialogOpen(false);
      setSelectedSubmission(null);
      setGradeData({ grade: 0, feedback: "" });
      fetchAssignments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to submit grade",
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
    }
  }

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      await api.post("/assignments", formData);
      toast({
        title: "Success",
        description: "Assignment created successfully!",
      });
      setDialogOpen(false);
      setFormData({ title: "", description: "", class: "", dueDate: "", maxPoints: 100 });
      fetchAssignments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to create assignment",
        variant: "destructive",
      });
    } finally {
      setFormLoading(false);
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Assignments</h1>
            <p className="text-muted-foreground">View and submit assignments</p>
          </div>

          {(user?.role === "teacher" || user?.role === "admin") && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Assignment
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Assignment</DialogTitle>
                  <DialogDescription>Add a new assignment for students</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateAssignment} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Essay on World History"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="class">Class</Label>
                    <Select
                      value={formData.class}
                      onValueChange={(value) => setFormData({ ...formData, class: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((classItem) => (
                          <SelectItem key={classItem.id || classItem._id} value={classItem.id || classItem._id}>
                            {classItem.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="dueDate">Due Date</Label>
                      <Input
                        id="dueDate"
                        type="datetime-local"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxPoints">Max Points</Label>
                      <Input
                        id="maxPoints"
                        type="number"
                        value={formData.maxPoints}
                        onChange={(e) =>
                          setFormData({ ...formData, maxPoints: parseInt(e.target.value) })
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Assignment instructions..."
                      rows={4}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={formLoading}>
                    {formLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Assignment"
                    )}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Assignments List */}
        {assignments.length === 0 ? (
          <Card className="shadow-md">
            <CardContent className="flex min-h-[300px] items-center justify-center">
              <div className="text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-lg font-medium">No assignments yet</p>
                <p className="text-sm text-muted-foreground">
                  {user?.role === "student"
                    ? "Check back later for new assignments"
                    : "Create an assignment to get started"}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {assignments.map((assignment) => {
              const status = getStatus(assignment);
              const StatusIcon = status.icon;
              const userSubmission = getUserSubmission(assignment);
              const isOwner = isAssignmentOwner(assignment);

              return (
                <Card key={assignment.id || assignment._id} className="transition-all hover:shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <CardTitle>{assignment.title}</CardTitle>
                          <Badge variant={status.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                        </div>
                        <CardDescription>
                          {assignment.class?.name}
                          {assignment.teacher && ` • By ${typeof assignment.teacher === 'object' ? assignment.teacher.username : 'Teacher'}`}
                        </CardDescription>
                      </div>
                      
                      {/* Delete button for teachers */}
                      {isOwner && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAssignment(assignment.id || assignment._id)}
                          disabled={deleteLoading === (assignment.id || assignment._id)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        >
                          {deleteLoading === assignment._id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{assignment.description}</p>
                    <div className="flex flex-wrap gap-4 border-t pt-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        Due: {new Date(assignment.dueDate).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Award className="h-4 w-4" />
                        {assignment.maxPoints} points
                      </div>
                      {assignment.submissions && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <FileText className="h-4 w-4" />
                          {assignment.submissions.length} submissions
                        </div>
                      )}
                    </div>

                    {/* Show student's submission details */}
                    {user?.role === "student" && userSubmission && (
                      renderStudentSubmissionInfo(assignment)
                    )}

                    <div className="flex gap-2">
                      {user?.role === "student" ? (
                        !userSubmission && (
                          <Button
                            className="gap-2"
                            onClick={() => {
                              setSelectedAssignment(assignment);
                              setSubmitDialogOpen(true);
                            }}
                          >
                            <Upload className="h-4 w-4" />
                            Submit Assignment
                          </Button>
                        )
                      ) : (
                        // Teacher actions
                        <>
                          <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => {
                              setSelectedAssignment(assignment);
                              setSubmissionsDialogOpen(true);
                            }}
                          >
                            <FileText className="h-4 w-4" />
                            View Submissions ({assignment.submissions?.length || 0})
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Submit Assignment Dialog */}
        <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Assignment</DialogTitle>
              <DialogDescription>Upload your completed work</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitAssignment} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file">Select File</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={handleFileSelect}
                  accept=".pdf,.doc,.docx,.txt,.zip,.jpg,.jpeg,.png"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Supported formats: PDF, DOC, DOCX, TXT, ZIP, JPG, PNG (Max 10MB)
                </p>
              </div>

              {selectedFile && (
                <div className="border rounded-lg p-3 bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm font-medium">{selectedFile.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({formatFileSize(selectedFile.size)})
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedFile(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Uploading... {uploadProgress}%
                      </p>
                    </div>
                  )}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                disabled={formLoading || !selectedFile}
              >
                {formLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {uploadProgress < 100 ? 'Uploading...' : 'Submitting...'}
                  </>
                ) : (
                  "Submit Assignment"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* View Submissions Dialog (Teachers) */}
        <Dialog open={submissionsDialogOpen} onOpenChange={setSubmissionsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Submissions for {selectedAssignment?.title}</DialogTitle>
              <DialogDescription>
                View and grade student submissions
              </DialogDescription>
            </DialogHeader>
            {selectedAssignment && (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedAssignment.submissions?.map((submission) => (
                      <TableRow key={submission._id}>
                        <TableCell className="font-medium">
                          {getStudentName(submission)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span className="text-sm">{submission.fileName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatFileSize(submission.fileSize)}
                        </TableCell>
                        <TableCell>
                          {new Date(submission.submittedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {submission.grade !== undefined ? (
                            <Badge variant="default">
                              {submission.grade}/{selectedAssignment.maxPoints}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Not Graded</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadFile(submission)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedSubmission(submission);
                                setGradeData({
                                  grade: submission.grade || 0,
                                  feedback: submission.feedback || ""
                                });
                                setGradeDialogOpen(true);
                              }}
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!selectedAssignment.submissions?.length && (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No submissions yet</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Grade Submission Dialog */}
        <Dialog open={gradeDialogOpen} onOpenChange={setGradeDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Grade Submission</DialogTitle>
              <DialogDescription>
                Grade {selectedSubmission && getStudentName(selectedSubmission)}'s work
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleGradeAssignment} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="grade">Grade (out of {selectedAssignment?.maxPoints})</Label>
                <Input
                  id="grade"
                  type="number"
                  min="0"
                  max={selectedAssignment?.maxPoints}
                  value={gradeData.grade}
                  onChange={(e) => setGradeData({ ...gradeData, grade: parseInt(e.target.value) || 0 })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="feedback">Feedback</Label>
                <Textarea
                  id="feedback"
                  value={gradeData.feedback}
                  onChange={(e) => setGradeData({ ...gradeData, feedback: e.target.value })}
                  placeholder="Provide feedback to the student..."
                  rows={4}
                />
              </div>
              <Button type="submit" className="w-full" disabled={formLoading}>
                {formLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Grading...
                  </>
                ) : (
                  "Submit Grade"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}