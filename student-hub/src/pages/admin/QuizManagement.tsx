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
import { FileText, Plus, Trash2 } from "lucide-react";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

interface Quiz {
  id?: string;
  _id?: string;
  title: string;
  description: string;
  timeLimit: number;
  teacher?: {
    id?: string;
    _id?: string;
    username?: string;
    email?: string;
  };
  class?: {
    id?: string;
    _id?: string;
    name?: string;
    subject?: string;
  };
  questions: any[];
  submissions: any[];
  createdAt?: string;
}

export default function QuizManagement() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  const [newQuiz, setNewQuiz] = useState({
    title: "",
    description: "",
    classId: "",
    teacherId: "",
    timeLimit: 30,
    questions: [
      {
        question: "",
        options: ["", "", "", ""],
        correctAnswer: 0,
        points: 1,
      },
    ],
  });

  useEffect(() => {
    fetchQuizzes();
    fetchClasses();
    fetchTeachers();
  }, []);

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      const response = await api.get("/admin/quizzes");
      const data = response.data.data || response.data;
      setQuizzes(data.quizzes || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to fetch quizzes",
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
      const response = await api.get('/admin/users', { params: { role: 'teacher' } });
      const data = response.data.data || response.data;
      setTeachers(data.users || []);
    } catch (error) {
      console.error('Failed to fetch teachers:', error);
    }
  };

  const createQuiz = async () => {
    try {
      await api.post("/admin/quizzes", newQuiz);
      toast({ title: "Success", description: "Quiz created successfully" });
      setCreateDialogOpen(false);
      setNewQuiz({
        title: "",
        description: "",
        classId: "",
        teacherId: "",
        timeLimit: 30,
        questions: [{ question: "", options: ["", "", "", ""], correctAnswer: 0, points: 1 }],
      });
      fetchQuizzes();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to create quiz",
        variant: "destructive",
      });
    }
  };

  const deleteQuiz = async (quizId: string) => {
    if (!confirm("Are you sure you want to delete this quiz?")) return;

    try {
      await api.delete(`/admin/quizzes/${quizId}`);
      toast({ title: "Success", description: "Quiz deleted successfully" });
      fetchQuizzes();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete quiz",
        variant: "destructive",
      });
    }
  };

  const addQuestion = () => {
    setNewQuiz({
      ...newQuiz,
      questions: [
        ...newQuiz.questions,
        { question: "", options: ["", "", "", ""], correctAnswer: 0, points: 1 },
      ],
    });
  };

  return (
    <AdminLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Quiz Management</h1>
            <p className="text-muted-foreground mt-2">Create and manage quizzes</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Quiz
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Quiz</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Quiz Title</Label>
                  <Input
                    id="title"
                    value={newQuiz.title}
                    onChange={(e) => setNewQuiz({ ...newQuiz, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newQuiz.description}
                    onChange={(e) => setNewQuiz({ ...newQuiz, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="class">Class</Label>
                    <Select value={newQuiz.classId} onValueChange={(value) => setNewQuiz({ ...newQuiz, classId: value })}>
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
                    <Select value={newQuiz.teacherId} onValueChange={(value) => setNewQuiz({ ...newQuiz, teacherId: value })}>
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

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Questions</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                      Add Question
                    </Button>
                  </div>
                  {newQuiz.questions.map((q, qIndex) => (
                    <Card key={qIndex} className="p-4">
                      <div className="space-y-3">
                        <Input
                          placeholder={`Question ${qIndex + 1}`}
                          value={q.question}
                          onChange={(e) => {
                            const updated = [...newQuiz.questions];
                            updated[qIndex].question = e.target.value;
                            setNewQuiz({ ...newQuiz, questions: updated });
                          }}
                        />
                        {q.options.map((opt: string, oIndex: number) => (
                          <div key={oIndex} className="flex gap-2">
                            <Input
                              placeholder={`Option ${oIndex + 1}`}
                              value={opt}
                              onChange={(e) => {
                                const updated = [...newQuiz.questions];
                                updated[qIndex].options[oIndex] = e.target.value;
                                setNewQuiz({ ...newQuiz, questions: updated });
                              }}
                            />
                            <input
                              type="radio"
                              checked={q.correctAnswer === oIndex}
                              onChange={() => {
                                const updated = [...newQuiz.questions];
                                updated[qIndex].correctAnswer = oIndex;
                                setNewQuiz({ ...newQuiz, questions: updated });
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>

                <Button onClick={createQuiz} className="w-full">Create Quiz</Button>
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
            quizzes.map((quiz) => (
              <Card key={quiz.id || quiz._id} className="border-border hover:shadow-lg transition-shadow">
                <CardHeader className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      <CardTitle className="text-lg">{quiz.title}</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteQuiz(quiz.id || quiz._id)}
                      className="text-white hover:bg-white/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-3">
                  <p className="text-sm text-muted-foreground">{quiz.description}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Class:</span>
                    <span className="font-medium">{quiz.class?.name || "N/A"}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Questions:</span>
                    <span className="font-medium">{quiz.questions?.length || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Submissions:</span>
                    <span className="font-medium">{quiz.submissions?.length || 0}</span>
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