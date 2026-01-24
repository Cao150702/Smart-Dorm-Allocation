"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Users, Bed, CheckCircle, AlertCircle, RefreshCw, Plus, Settings, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

// Define types locally
type Student = {
    id: string
    name: string
    studentId: string
    gender: string
    major: string
    assignedDormId: string | null
}

type Dorm = {
    id: string
    name: string
    gender: string
    capacity: number
    students: Student[]
}

type Stats = {
    totalStudents: number
    allocatedStudents: number
    unallocatedStudents: number
    totalDorms: number
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<Stats | null>(null)
    const [students, setStudents] = useState<Student[]>([])
    const [dorms, setDorms] = useState<Dorm[]>([])
    const [loading, setLoading] = useState(true)
    const [allocating, setAllocating] = useState(false)
    const [isaddStudentOpen, setIsAddStudentOpen] = useState(false)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)

    // Config State
    const [config, setConfig] = useState<{ majors: string[], hobbies: string[] }>({ majors: [], hobbies: [] })
    const [newMajor, setNewMajor] = useState("")
    const [newHobby, setNewHobby] = useState("")

    // New Student State
    const [newStudent, setNewStudent] = useState({
        name: "",
        studentId: "",
        password: "123", // Default password
        gender: "male",
        major: "",
        bedTime: 22,
        wakeTime: 7,
        isSmoker: false,
        hobbies: [] as string[], // Default
        personality: "INTJ" // Default
    })

    // Manual Action State
    const [viewStudent, setViewStudent] = useState<Student | null>(null)
    const [assignTarget, setAssignTarget] = useState<Student | null>(null)

    const fetchData = async () => {
        setLoading(true)
        try {
            const [resData, resConfig] = await Promise.all([
                fetch("/api/admin/data").then(r => r.json()),
                fetch("/api/config").then(r => r.json())
            ])

            setStats(resData.stats)
            setStudents(resData.students)
            setDorms(resData.dorms)

            if (resConfig && Array.isArray(resConfig.majors)) {
                setConfig(resConfig)
                // Set default major if empty
                if (resConfig.majors.length > 0 && !newStudent.major) {
                    setNewStudent(prev => ({ ...prev, major: resConfig.majors[0] }))
                }
            } else {
                setConfig({ majors: [], hobbies: [] })
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const handleAllocate = async () => {
        setAllocating(true)
        try {
            const res = await fetch("/api/admin/allocate", { method: "POST" })
            const data = await res.json()
            if (data.success) {
                alert(`成功分配了 ${data.allocatedCount} 名学生!`)
                fetchData()
            } else {
                alert("分配失败或没有等待分配的学生。")
            }
        } catch (e) {
            alert("执行分配时出错")
        } finally {
            setAllocating(false)
        }
    }

    const handleAddStudent = async () => {
        try {
            const res = await fetch("/api/students", {
                method: "POST",
                body: JSON.stringify(newStudent),
                headers: { "Content-Type": "application/json" }
            })
            const data = await res.json()
            if (res.ok) {
                alert("添加学生成功")
                setIsAddStudentOpen(false)
                fetchData()
                // Reset form
                setNewStudent({ ...newStudent, studentId: "", name: "" })
            } else {
                // Show detailed error
                const errorMsg = typeof data.error === 'string'
                    ? data.error
                    : JSON.stringify(data.error?.message || data.error);
                alert("添加失败: " + errorMsg)
            }
        } catch (e) {
            alert("网络错误")
        }
    }

    const handleConfigUpdate = async (type: 'major' | 'hobby', action: 'add' | 'delete', value: string) => {
        if (!value) return;
        try {
            const res = await fetch("/api/config", {
                method: "POST",
                body: JSON.stringify({ type, action, value }),
                headers: { "Content-Type": "application/json" }
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || "API Error");
            }

            // Optimistic update or reload
            const newConfig = await fetch("/api/config").then(r => r.json());
            if (newConfig && Array.isArray(newConfig.majors)) {
                setConfig(newConfig)
            }

            if (action === 'add') {
                if (type === 'major') setNewMajor("")
                if (type === 'hobby') setNewHobby("")
            }
        } catch (error) {
            console.error(error);
            alert("操作失败: " + String(error))
        }
    }

    const handleManualAction = async (action: 'assign' | 'remove', studentId: string, dormId?: string) => {
        try {
            const res = await fetch("/api/admin/allocate/manual", {
                method: "POST",
                body: JSON.stringify({ studentId, dormId, action }),
                headers: { "Content-Type": "application/json" }
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed");
            }
            fetchData(); // Reload
            if (action === 'assign') setAssignTarget(null);
        } catch (error: any) {
            alert("操作失败: " + error.message);
        }
    }

    if (loading) return <div className="p-10 text-white text-center">正在加载后台数据...</div>

    return (
        <div className="min-h-screen bg-gray-950 text-white p-8 space-y-8">

            {/* Header */}
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
                        智慧寝室管理后台
                    </h1>
                    <p className="text-gray-400">学生信息管理与智能分配系统</p>
                </div>
                <div className="flex gap-2">
                    <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800">
                                <Settings className="mr-2 h-4 w-4" />设置
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>系统参数配置</DialogTitle>
                                <DialogDescription>管理系统中的专业列表和兴趣标签，供学生选择。</DialogDescription>
                            </DialogHeader>
                            <Tabs defaultValue="major" className="w-full mt-4">
                                <TabsList className="bg-gray-800 text-gray-400 w-full justify-start">
                                    <TabsTrigger value="major" className="flex-1">专业管理</TabsTrigger>
                                    <TabsTrigger value="hobby" className="flex-1">兴趣标签</TabsTrigger>
                                </TabsList>

                                <TabsContent value="major" className="space-y-4 py-4 min-h-[300px]">
                                    <div className="flex gap-2 items-center bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                                        <Input
                                            placeholder="输入新专业名称..."
                                            value={newMajor}
                                            onChange={e => setNewMajor(e.target.value)}
                                            className="bg-gray-900 border-gray-600 text-white focus-visible:ring-indigo-500 placeholder:text-gray-500"
                                            onKeyDown={(e) => e.key === 'Enter' && handleConfigUpdate('major', 'add', newMajor)}
                                        />
                                        <Button onClick={() => handleConfigUpdate('major', 'add', newMajor)} variant="secondary" className="text-white hover:text-white bg-gray-700 hover:bg-gray-600">添加</Button>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-gray-500 uppercase tracking-widest pl-1">现有专业 ({config.majors?.length || 0})</Label>
                                        <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto p-1">
                                            {(config.majors || []).map(m => (
                                                <Badge key={m} variant="secondary" className="pl-3 pr-1 py-1.5 text-sm flex items-center gap-2 bg-gray-800 text-gray-200 hover:bg-gray-700 border-gray-700">
                                                    {m}
                                                    <button
                                                        onClick={() => handleConfigUpdate('major', 'delete', m)}
                                                        className="hover:bg-red-500/20 hover:text-red-400 rounded-full p-0.5 transition-colors"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                            {(config.majors || []).length === 0 && <p className="text-gray-500 text-sm">暂无专业数据</p>}
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="hobby" className="space-y-4 py-4 min-h-[300px]">
                                    <div className="flex gap-2 items-center bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                                        <Input
                                            placeholder="输入新兴趣标签..."
                                            value={newHobby}
                                            onChange={e => setNewHobby(e.target.value)}
                                            className="bg-gray-900 border-gray-600 text-white focus-visible:ring-pink-500 placeholder:text-gray-500"
                                            onKeyDown={(e) => e.key === 'Enter' && handleConfigUpdate('hobby', 'add', newHobby)}
                                        />
                                        <Button onClick={() => handleConfigUpdate('hobby', 'add', newHobby)} variant="secondary" className="text-white hover:text-white bg-gray-700 hover:bg-gray-600">添加</Button>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs text-gray-500 uppercase tracking-widest pl-1">现有标签 ({config.hobbies?.length || 0})</Label>
                                        <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto p-1">
                                            {(config.hobbies || []).map(h => (
                                                <Badge key={h} variant="outline" className="pl-3 pr-1 py-1.5 text-sm flex items-center gap-2 border-gray-600 text-gray-200 hover:border-pink-500/50 hover:bg-pink-500/10 transition-colors">
                                                    {h}
                                                    <button
                                                        onClick={() => handleConfigUpdate('hobby', 'delete', h)}
                                                        className="hover:bg-red-500/20 hover:text-red-400 rounded-full p-0.5 transition-colors"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                            {(config.hobbies || []).length === 0 && <p className="text-gray-500 text-sm">暂无兴趣标签</p>}
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isaddStudentOpen} onOpenChange={setIsAddStudentOpen}>
                        <DialogTrigger asChild>
                            <Button variant="premium" className="shadow-lg shadow-indigo-500/20">
                                <Plus className="mr-2 h-4 w-4" /> 录入学生
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>录入新学生信息</DialogTitle>
                                <DialogDescription>
                                    手动添加学生信息。学生后续可使用学号和密码登录补充画像。
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>姓名</Label>
                                        <Input value={newStudent.name} onChange={e => setNewStudent({ ...newStudent, name: e.target.value })} className="bg-gray-800 border-gray-700 text-white" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>学号</Label>
                                        <Input value={newStudent.studentId} onChange={e => setNewStudent({ ...newStudent, studentId: e.target.value })} className="bg-gray-800 border-gray-700 text-white" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>密码</Label>
                                        <Input value={newStudent.password} onChange={e => setNewStudent({ ...newStudent, password: e.target.value })} className="bg-gray-800 border-gray-700 text-white" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>性别</Label>
                                        <Select value={newStudent.gender} onValueChange={v => setNewStudent({ ...newStudent, gender: v })}>
                                            <SelectTrigger className="bg-gray-800 border-gray-700 text-white"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="male">男</SelectItem>
                                                <SelectItem value="female">女</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>专业</Label>
                                    <Select value={newStudent.major} onValueChange={v => setNewStudent({ ...newStudent, major: v })}>
                                        <SelectTrigger className="bg-gray-800 border-gray-700 text-white"><SelectValue /></SelectTrigger>
                                        <SelectContent className="max-h-60 bg-gray-900 border-gray-800 text-white">
                                            {(config.majors || []).map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="premium" onClick={handleAddStudent} className="w-full">确认添加</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Button onClick={handleAllocate} disabled={allocating || stats?.unallocatedStudents === 0} variant="secondary" className="border-l border-white/10 ml-2">
                        <RefreshCw className={`mr-2 h-4 w-4 ${allocating ? "animate-spin" : ""}`} />
                        {allocating ? "分配中" : "一键分配"}
                    </Button>
                </div>
            </header>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatsCard title="学生总数" value={stats?.totalStudents} icon={<Users className="text-blue-400" />} />
                <StatsCard title="已分配" value={stats?.allocatedStudents} icon={<CheckCircle className="text-green-400" />} />
                <StatsCard title="待分配" value={stats?.unallocatedStudents} icon={<AlertCircle className="text-yellow-400" />} />
                <StatsCard title="寝室总数" value={stats?.totalDorms} icon={<Bed className="text-purple-400" />} />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Unallocated Students List */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="flex justify-between items-center sticky top-0 bg-gray-950 py-2 z-10">
                        <h2 className="text-xl font-semibold text-gray-200">待分配列表 ({stats?.unallocatedStudents})</h2>
                    </div>

                    <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {students.filter(s => !s.assignedDormId).map(student => (
                            <motion.div layout key={student.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                <Card className="bg-gray-900 border-gray-800 group hover:border-indigo-500/50 transition-all cursor-pointer" onClick={() => setViewStudent(student)}>
                                    <CardContent className="p-4 flex justify-between items-center">
                                        <div>
                                            <div className="font-medium text-gray-200 flex items-center gap-2">
                                                {student.name}
                                                <span className="text-xs bg-gray-800 px-1.5 py-0.5 rounded text-gray-400">{student.studentId}</span>
                                            </div>
                                            <div className="text-xs text-gray-500">{student.major} • {student.gender === 'male' ? '男' : '女'}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 px-2 border-gray-700 hover:bg-indigo-900/50 hover:text-indigo-400 hover:border-indigo-500"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setAssignTarget(student);
                                                }}
                                            >
                                                分配
                                            </Button>
                                            <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-500 flex items-center">待定</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                        {students.filter(s => !s.assignedDormId).length === 0 && (
                            <div className="text-gray-500 text-sm text-center py-10 opacity-50">所有学生均已分配寝室</div>
                        )}
                    </div>
                </div>

                {/* Rooms Grid */}
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-xl font-semibold text-gray-200 sticky top-0 bg-gray-950 py-2 z-10">寝室分配概览</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {dorms.map(dorm => (
                            <motion.div layout key={dorm.id} initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
                                <Card className="bg-gray-900 border-gray-800 hover:border-indigo-500/30 transition-colors">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between">
                                            <CardTitle className="text-lg text-indigo-300">{dorm.name}</CardTitle>
                                            <span className="text-xs text-gray-500 uppercase px-2 py-1 bg-gray-800 rounded">{dorm.gender === 'male' ? '男生寝室' : '女生寝室'}</span>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {dorm.students.map(s => (
                                                <div key={s.id} className="text-sm bg-gray-800/50 p-2 rounded flex justify-between items-center group cursor-pointer hover:bg-gray-800" onClick={() => setViewStudent(s)}>
                                                    <div className="flex gap-2">
                                                        <span>{s.name}</span>
                                                        <span className="text-gray-500 text-xs self-center">{s.studentId}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-gray-500">{s.major}</span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (confirm("确认将该学生移出寝室吗？")) handleManualAction('remove', s.id);
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            {/* Empty Slots */}
                                            {[...Array(Math.max(0, dorm.capacity - dorm.students.length))].map((_, i) => (
                                                <div key={`empty-${i}`} className="h-9 border-2 border-dashed border-gray-800 rounded flex items-center justify-center text-xs text-gray-600">
                                                    空床位
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                </div>

            </div>

            {/* Student Detail Modal */}
            <Dialog open={!!viewStudent} onOpenChange={(o) => !o && setViewStudent(null)}>
                <DialogContent className="bg-gray-900 border-gray-800 text-white">
                    <DialogHeader>
                        <DialogTitle>{viewStudent?.name} - 详细信息</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div>
                            <Label className="text-gray-500 text-xs">学号</Label>
                            <div className="text-lg">{viewStudent?.studentId}</div>
                        </div>
                        <div>
                            <Label className="text-gray-500 text-xs">专业</Label>
                            <div className="text-lg">{viewStudent?.major}</div>
                        </div>
                        <div>
                            <Label className="text-gray-500 text-xs">性别</Label>
                            <div className="text-lg">{viewStudent?.gender === 'male' ? '男' : '女'}</div>
                        </div>
                        <div>
                            <Label className="text-gray-500 text-xs">MBTI</Label>
                            <div className="text-lg font-mono text-yellow-400">{(viewStudent as any)?.personality || '未填'}</div>
                        </div>
                        <div>
                            <Label className="text-gray-500 text-xs">作息</Label>
                            <div>{(viewStudent as any)?.bedTime}:00 睡 - {(viewStudent as any)?.wakeTime}:00 起</div>
                        </div>
                        <div>
                            <Label className="text-gray-500 text-xs">吸烟</Label>
                            <div>{(viewStudent as any)?.isSmoker ? '是' : '否'}</div>
                        </div>
                        <div className="col-span-2">
                            <Label className="text-gray-500 text-xs">兴趣爱好</Label>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {(() => {
                                    try {
                                        const h = (viewStudent as any)?.hobbies;
                                        const tags = typeof h === 'string' ? JSON.parse(h) : h;
                                        return Array.isArray(tags) ? tags.map((t: string) => <Badge key={t} variant="secondary" className="bg-gray-800 text-gray-300">{t}</Badge>) : '无';
                                    } catch { return '无' }
                                })()}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Manual Assign Modal */}
            <Dialog open={!!assignTarget} onOpenChange={(o) => !o && setAssignTarget(null)}>
                <DialogContent className="bg-gray-900 border-gray-800 text-white">
                    <DialogHeader>
                        <DialogTitle>手动分配寝室</DialogTitle>
                        <DialogDescription>
                            为 {assignTarget?.name} 选择一个寝室。仅显示有空位的同性寝室。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-2 max-h-[300px] overflow-y-auto">
                        {dorms
                            .filter(d => d.gender === assignTarget?.gender && d.students.length < d.capacity)
                            .map(d => (
                                <div key={d.id} className="flex justify-between items-center p-3 bg-gray-800 rounded border border-gray-700 hover:border-indigo-500 cursor-pointer" onClick={() => handleManualAction('assign', assignTarget!.id, d.id)}>
                                    <div>
                                        <div className="font-bold text-indigo-300">{d.name}</div>
                                        <div className="text-xs text-gray-500">{d.students.length}/{d.capacity} 人</div>
                                    </div>
                                    <Button size="sm" variant="secondary">选择</Button>
                                </div>
                            ))
                        }
                        {dorms.filter(d => d.gender === assignTarget?.gender && d.students.length < d.capacity).length === 0 && (
                            <div className="text-center text-gray-500 py-4">没有可用的寝室</div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    )
}

function StatsCard({ title, value, icon }: { title: string, value: any, icon: React.ReactNode }) {
    return (
        <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-6 flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-400">{title}</p>
                    <div className="text-2xl font-bold text-white">{value ?? 0}</div>
                </div>
                <div className="p-3 bg-gray-800 rounded-full">
                    {icon}
                </div>
            </CardContent>
        </Card>
    )
}
