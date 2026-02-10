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
import { ClipboardList, Plus, Trash2 } from "lucide-react";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

interface Assignment {
  _id: string;
  title: string;
  description: string;
  dueDate: string;
  maxPoints: number;
  teacher: {
    _id: string;
    username: string;
    email: string;
  };
  class: {
    _id: string;
    name: string;
    subject: string;
  };
  submissions: any[];
  createdAt: string;
}

export default function AssignmentManagement() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  const [newAssignment, setNewAssignment] = useState({
    title: "",
    description: "",
    classId: "",
    teacherId: "",
    dueDate: "",
    maxPoints: 100,
  });

  useEffect(() => {
    fetchAssignments();
    fetchClasses();
    fetchTeachers();
  }, []);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const response = await api.get("/admin/assignments");
      const data = response.data.data || response.data;
      setAssignments(data.assignments || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to fetch assignments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await api.get("/admin/classes");
      const data = response.data.data || response.data;
      setClasses(data.classes || []);
    } catch (error) {
      console.error("Failed to fetch classes:", error);
    }
  };

  const fetchTeachers = async () => {
    try {
      const response = await api.get("/admin/users", { params: { role: "teacher" } });
      const data = response.data.data || response.data;
      setTeachers(data.users || []);
    } catch (error) {
      console.error("Failed to fetch teachers:", error);
    }
  };

  const createAssignment = async () => {
    try {
      await api.post("/admin/assignments", newAssignment);
      toast({ title: "Success", description: "Assignment created successfully" });
      setCreateDialogOpen(false);
      setNewAssignment({
        title: "",
        description: "",
        classId: "",
        teacherId: "",
        dueDate: "",
        maxPoints: 100,
      });
      fetchAssignments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to create assignment",
        variant: "destructive",
      });
    }
  };

  const deleteAssignment = async (assignmentId: string) => {
    if (!confirm("Are you sure you want to delete this assignment?")) return;

    try {
      await api.delete(`/admin/assignments/${assignmentId}`);
      toast({ title: "Success", description: "Assignment deleted successfully" });
      fetchAssignments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete assignment",
        variant: "destructive",
      });
    }
  };

  return (
    <AdminLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Assignment Management</h1>
            <p className="text-muted-foreground mt-2">Create and manage assignments across all classes</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Assignment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Assignment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Assignment Title</Label>
                  <Input
                    id="title"
                    value={newAssignment.title}
                    onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newAssignment.description}
                    onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="class">Class</Label>
                    <Select value={newAssignment.classId} onValueChange={(value) => setNewAssignment({ ...newAssignment, classId: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id || cls._id} value={cls.id || cls._id}>
                            {cls.name || cls.title} ({cls.subject})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="teacher">Teacher</Label>
                    <Select value={newAssignment.teacherId} onValueChange={(value) => setNewAssignment({ ...newAssignment, teacherId: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select teacher" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher.id || teacher._id} value={teacher.id || teacher._id}>
                            {teacher.username} ({teacher.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="datetime-local"
                      value={newAssignment.dueDate}
                      onChange={(e) => setNewAssignment({ ...newAssignment, dueDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxPoints">Maximum Points</Label>
                    <Input
                      id="maxPoints"
                      type="number"
                      value={newAssignment.maxPoints}
                      onChange={(e) => setNewAssignment({ ...newAssignment, maxPoints: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
                <Button onClick={createAssignment} className="w-full">Create Assignment</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            [...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-24 bg-muted" />
                <CardContent className="h-32 bg-muted/50" />
              </Card>
            ))
          ) : (
            assignments.map((assignment) => (
              <Card key={assignment.id || assignment._id} className="border-border hover:shadow-lg transition-shadow">
                <CardHeader className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5" />
                      <CardTitle className="text-lg">{assignment.title}</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteAssignment(assignment.id || assignment._id)}
                      className="text-white hover:bg-white/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-2">{assignment.description}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Class:</span>
                    <span className="font-medium">{assignment.class?.name || "N/A"}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Teacher:</span>
                    <span className="font-medium">{assignment.teacher?.username || "N/A"}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Due Date:</span>
                    <span className="font-medium">
                      {(assignment.due_date || assignment.dueDate) ? new Date(assignment.due_date || assignment.dueDate).toLocaleDateString() : "No due date"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Submissions:</span>
                    <span className="font-medium">{assignment.submissions?.length || 0}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  );
}