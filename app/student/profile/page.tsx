"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { LogOut, CheckCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const studentSchema = z.object({
    name: z.string().min(1, "姓名不能为空"),
    studentId: z.string(), // Read only
    gender: z.enum(["male", "female"]),
    major: z.string().min(1, "专业不能为空"),
    bedTime: z.coerce.number().min(0).max(23),
    wakeTime: z.coerce.number().min(0).max(23),
    isSmoker: z.boolean().default(false),
    personality: z.string().min(1),
    hobbies: z.array(z.string()).min(1, "请至少选择一个爱好"),
})

type StudentFormValues = z.infer<typeof studentSchema>



export default function StudentProfile() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [student, setStudent] = useState<any>(null)
    const MBTI_TYPES = ["INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP", "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP"]

    // Config state
    const [majors, setMajors] = useState<string[]>(["计算机科学", "电子工程", "艺术设计", "经济学", "法学", "医学", "物理学", "化学"])
    const [hobbies, setHobbies] = useState<string[]>(["阅读", "游戏", "运动", "音乐", "编程", "旅游", "摄影", "烹饪"])

    useEffect(() => {
        fetch("/api/config")
            .then(res => res.json())
            .then(data => {
                if (data.majors && data.majors.length > 0) setMajors(data.majors);
                if (data.hobbies && data.hobbies.length > 0) setHobbies(data.hobbies);
            })
            .catch(console.error)
    }, [])

    // Use React Hook Form
    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<StudentFormValues>({
        resolver: zodResolver(studentSchema) as any,
        defaultValues: {
            isSmoker: false,
            hobbies: [],
        }
    })

    // Load student from API
    useEffect(() => {
        const s = localStorage.getItem("currentStudent")
        if (!s) {
            router.push("/")
            return
        }
        const localData = JSON.parse(s)
        const idToFetch = localData.id || localData.studentId;

        // Fetch fresh data
        fetch(`/api/students/${idToFetch}`)
            .then(res => {
                if (!res.ok) throw new Error("Load failed");
                return res.json();
            })
            .then(data => {
                setStudent(data)
                // Populate form
                setValue("name", data.name)
                setValue("studentId", data.studentId)
                setValue("gender", data.gender as any)
                setValue("major", data.major)
                setValue("personality", data.personality)
                setValue("bedTime", data.bedTime)
                setValue("wakeTime", data.wakeTime)
                setValue("isSmoker", data.isSmoker)
                if (data.hobbies) {
                    try {
                        const h = typeof data.hobbies === 'string' ? JSON.parse(data.hobbies) : data.hobbies;
                        setValue("hobbies", h)
                    } catch {
                        setValue("hobbies", [])
                    }
                }
            })
            .catch(err => {
                console.error(err)
                // Fallback to local data if API fails? Or redirect?
                setStudent(localData)
            })
    }, [router, setValue])

    const selectedHobbies = watch("hobbies") || []

    const toggleHobby = (hobby: string) => {
        const current = selectedHobbies
        const newHobbies = current.includes(hobby)
            ? current.filter(h => h !== hobby)
            : [...current, hobby]

        setValue("hobbies", newHobbies)
    }

    const handleLogout = () => {
        localStorage.removeItem("currentStudent")
        router.push("/")
    }

    const onSave = async (values: StudentFormValues) => {
        setLoading(true)
        try {
            const res = await fetch(`/api/students/${student.id || student.studentId}`, {
                method: "PATCH",
                body: JSON.stringify(values),
                headers: { "Content-Type": "application/json" }
            })
            if (!res.ok) throw new Error("Save failed")

            // Update local storage too to keep it in sync roughly
            const updated = await res.json()
            localStorage.setItem("currentStudent", JSON.stringify(updated))
            setStudent(updated)

            alert("保存成功!")
        } catch (error) {
            alert("保存失败，请重试")
        } finally {
            setLoading(false)
        }
    }

    if (!student) return null

    return (
        <div className="min-h-screen bg-gray-950 p-4 pb-20">
            <nav className="flex justify-between items-center max-w-4xl mx-auto py-6 mb-4 border-b border-gray-800">
                <div className="text-white font-bold text-lg">智慧寝室</div>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-400 hover:text-white">
                    <LogOut className="mr-2 h-4 w-4" /> 退出
                </Button>
            </nav>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-3xl mx-auto"
            >
                <Card className="border-gray-800 bg-gray-900/50">
                    <CardHeader>
                        <CardTitle className="text-2xl text-white">个人信息录入</CardTitle>
                        <CardDescription>完善您的画像，让我们帮您找到最匹配的室友。</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit(onSave)} className="space-y-6">

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>学号 (不可修改)</Label>
                                    <Input value={student.studentId} disabled className="bg-gray-800/50 text-gray-400" />
                                </div>
                                <div className="space-y-2">
                                    <Label>姓名</Label>
                                    <Input value={student.name} disabled className="bg-gray-800/50 text-gray-400" />
                                    <p className="text-xs text-gray-500">如需修改基本信息请联系管理员</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>MBTI 性格类型</Label>
                                <Select onValueChange={(val) => setValue("personality", val)} defaultValue={student.personality}>
                                    <SelectTrigger className="bg-gray-800 text-white">
                                        <SelectValue placeholder="选择您的性格类型" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MBTI_TYPES.map(t => (
                                            <SelectItem key={t} value={t}>{t}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.personality && <p className="text-red-500 text-xs text-right">请选择性格</p>}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>平时就寝时间 (Bed Time)</Label>
                                    <Select onValueChange={(val) => setValue("bedTime", parseInt(val))}>
                                        <SelectTrigger className="bg-gray-800">
                                            <SelectValue placeholder="选择时间" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[...Array(24)].map((_, i) => (
                                                <SelectItem key={i} value={i.toString()}>{i}:00</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>平时起床时间 (Wake Time)</Label>
                                    <Select onValueChange={(val) => setValue("wakeTime", parseInt(val))}>
                                        <SelectTrigger className="bg-gray-800">
                                            <SelectValue placeholder="选择时间" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[...Array(24)].map((_, i) => (
                                                <SelectItem key={i} value={i.toString()}>{i}:00</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>兴趣爱好 (多选)</Label>
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {hobbies.map(hobby => (
                                        <button
                                            key={hobby}
                                            type="button"
                                            onClick={() => toggleHobby(hobby)}
                                            className={cn(
                                                "px-4 py-2 rounded-lg text-sm font-medium border transition-all",
                                                selectedHobbies.includes(hobby)
                                                    ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                                                    : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:border-gray-600"
                                            )}
                                        >
                                            {selectedHobbies.includes(hobby) && <CheckCircle className="mr-1 h-3 w-3" />}
                                            {hobby}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center space-x-2 py-2">
                                <input
                                    type="checkbox"
                                    id="smoker"
                                    {...register("isSmoker")}
                                    className="w-5 h-5 rounded border-gray-600 text-indigo-600 focus:ring-indigo-500 bg-gray-700"
                                />
                                <Label htmlFor="smoker" className="cursor-pointer">我吸烟 (Smoker)</Label>
                            </div>

                            {/* 
                  NOTE: In a real app, we would have a 'Save' button here that calls an API to UPDATE the student. 
                  Since the task didn't explicitly ask for 'Updating' an existing profile API, but just 'Entry',
                  and we are re-using the creation logic or we assume this is just a display of capabilities.
                  However, to make it functional, I should probably add an Update API. 
                  For now, I'll just put a disabled button or a mock button.
               */}
                            <Button variant="premium" className="w-full h-12 text-lg" type="submit" disabled={loading}>
                                {loading ? "保存中..." : "保存资料"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    )
}
