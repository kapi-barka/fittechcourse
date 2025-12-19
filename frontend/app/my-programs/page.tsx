'use client'

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/AuthGuard'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { userProgramsAPI, ProgramWithStatus, scheduleAPI } from '@/lib/api'
import { Loader2, PlayCircle, Bookmark, Calendar, Dumbbell, Activity, Trash2 } from 'lucide-react'

export default function MyProgramsPage() {
    const router = useRouter()
    const [activePrograms, setActivePrograms] = useState<ProgramWithStatus[]>([])
    const [savedPrograms, setSavedPrograms] = useState<ProgramWithStatus[]>([])
    const [completedPrograms, setCompletedPrograms] = useState<ProgramWithStatus[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        fetchPrograms()
    }, [])

    const fetchPrograms = async () => {
        try {
            setIsLoading(true)
            const response = await userProgramsAPI.list()
            const allPrograms = response.data

            // Filter by status
            // Backend statuses: 'started', 'saved', 'completed'
            // But we also have 'is_active'.

            // Active = started AND is_active=true (Current) OR started (History)
            // Actually 'started' in backend for UserProgram means "User has interacted with/started it".
            // 'is_active' means "This is the CURRENTLY selected program".

            // Let's group:
            // 1. Current Active (is_active=True)
            // 2. In Progress (started but not active) - History? Or just "Started"
            // 3. Saved
            // 4. Completed

            const current = allPrograms.filter(p => p.is_active)
            const saved = allPrograms.filter(p => p.status === 'saved')
            const completed = allPrograms.filter(p => p.status === 'completed')

            // "In Progress" or "History" - started but not active
            const history = allPrograms.filter(p => p.status === 'started' && !p.is_active)

            // For UI, maybe combine Current + History into "My Workouts"? 
            // User asked: "смотреть список когда либо начатых мною программ ... или добавлять программы в отложенные"

            // Let's show:
            // - Active (Current) at top
            // - Saved 
            // - History (Started/Completed)

            setActivePrograms(current)
            setSavedPrograms(saved)

            // History includes both completed and just started-but-switched-away
            setCompletedPrograms([...completed, ...history])

        } catch (error) {
            console.error('Error fetching programs:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleResume = async (programId: string) => {
        try {
            await scheduleAPI.startProgram(programId)
            router.push('/schedule')
        } catch (error) {
            console.error('Error starting program:', error)
        }
    }

    const handleToggleSave = async (programId: string) => {
        try {
            await userProgramsAPI.toggleSave(programId)
            fetchPrograms() // Refresh list
        } catch (error) {
            console.error('Error toggling save:', error)
        }
    }

    const ProgramCard = ({ program, showResume = false }: { program: ProgramWithStatus, showResume?: boolean }) => (
        <Card className="hover:shadow-lg transition-shadow overflow-hidden flex flex-col h-full border-0 shadow">
            <div className="h-32 bg-gray-200 dark:bg-gray-800 relative">
                {program.image_url ? (
                    <img
                        src={program.image_url}
                        alt={program.title}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full bg-primary/80 flex items-center justify-center">
                        <Activity className="h-10 w-10 text-white/50" />
                    </div>
                )}
                <div className="absolute top-2 right-2">
                    {program.is_active && (
                        <span className="bg-green-400 text-white text-xs px-2 py-1 rounded-full font-semibold shadow-sm animate-pulse">
                            АКТИВНАЯ
                        </span>
                    )}
                </div>
            </div>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg line-clamp-1">{program.title}</CardTitle>
                <div className="flex items-center text-xs text-muted-foreground gap-3 mt-1">
                    {program.duration_weeks && (
                        <div className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {program.duration_weeks} нед.
                        </div>
                    )}
                    {program.difficulty && (
                        <span className="capitalize">{program.difficulty}</span>
                    )}
                </div>
            </CardHeader>
            <CardContent className="flex-1 pb-4">
                <p className="text-sm text-muted-foreground line-clamp-2">
                    {program.description || 'Описание отсутствует'}
                </p>
                <div className="mt-3 text-xs text-gray-400">
                    Последняя активность: {new Date(program.last_interaction_at || program.created_at).toLocaleDateString()}
                </div>
            </CardContent>
            <CardFooter className="pt-0 gap-2">
                <Button
                    className="flex-1"
                    variant={showResume ? "default" : "outline"}
                    onClick={() => showResume ? router.push('/schedule') : router.push(`/programs/${program.id}`)}
                >
                    {showResume ? <><PlayCircle className="mr-2 h-4 w-4" /> Продолжить</> : 'Подробнее'}
                </Button>
                {program.status === 'saved' ? (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleToggleSave(program.id)}
                        title="Удалить из сохраненных"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                ) : !program.is_active && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleResume(program.id)}
                        title="Сделать активной"
                    >
                        <PlayCircle className="h-4 w-4" />
                    </Button>
                )}
            </CardFooter>
        </Card>
    )

    return (
        <AuthGuard>
            <div className="min-h-screen">
                <main className="container mx-auto px-4 py-8">
                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="space-y-12">
                            {/* Active Section */}
                            {activePrograms.length > 0 && (
                                <section>
                                    <h2 className="text-xl font-semibold mb-4 flex items-center text-green-500 dark:text-green-400/80">
                                        <Activity className="mr-2 h-5 w-5" />
                                        Сейчас тренируюсь
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {activePrograms.map(p => (
                                            <ProgramCard key={p.id} program={p} showResume={true} />
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Saved Section */}
                            {savedPrograms.length > 0 && (
                                <section>
                                    <h2 className="text-lg font-semibold mb-4 flex items-center text-blue-600 dark:text-blue-400">
                                        <Bookmark className="mr-2 h-5 w-5" />
                                        Отложенные
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {savedPrograms.map(p => (
                                            <ProgramCard key={p.id} program={p} />
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* History Section */}
                            {completedPrograms.length > 0 && (
                                <section>
                                    <h2 className="text-lg font-semibold mb-4 flex items-center text-gray-600 dark:text-gray-400">
                                        <Calendar className="mr-2 h-5 w-5" />
                                        История активности
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {completedPrograms.map(p => (
                                            <ProgramCard key={p.id} program={p} />
                                        ))}
                                    </div>
                                </section>
                            )}

                            {activePrograms.length === 0 && savedPrograms.length === 0 && completedPrograms.length === 0 && (
                                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed">
                                    <Dumbbell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                    <h3 className="text-lg font-medium">У вас пока нет программ</h3>
                                    <p className="text-muted-foreground mb-4">Начните свое фитнес-путешествие прямо сейчас!</p>
                                    <Button onClick={() => router.push('/programs')}>
                                        <PlayCircle className="mr-2 h-4 w-4" />
                                        Найти программу
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </AuthGuard>
    )
}
