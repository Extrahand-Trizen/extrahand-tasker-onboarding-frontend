'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { caosApi, type Lead } from '@/lib/api/caos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Briefcase, CheckCircle } from 'lucide-react';
import { categoryDisplay } from '@/lib/leadLabels';
import { useJWTAuth } from '@/lib/hooks/useJWTAuth';
import { getUserIdentityIds, isLeadCreator } from '@/lib/leadCreatorAccess';

interface SkillsSectionProps {
  lead: Lead;
  leadId: string;
}

export function SkillsSection({ lead, leadId }: SkillsSectionProps) {
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useJWTAuth();
  const identityIds = getUserIdentityIds(user);
  const canEditSkills =
    !authLoading && isLeadCreator(lead.addedBy, identityIds) && lead.creationMethod !== 'bulk_upload';
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSkillIndex, setSelectedSkillIndex] = useState<number | null>(null);
  const [skillName, setSkillName] = useState('');
  const [skillCategory, setSkillCategory] = useState('');
  const [skillLevel, setSkillLevel] = useState<'beginner' | 'experienced'>('experienced');
  const [toolsAvailable, setToolsAvailable] = useState(false);

  const addSkillMutation = useMutation({
    mutationFn: (data: { name: string; category?: string; level?: 'beginner' | 'experienced'; toolsAvailable?: boolean }) =>
      caosApi.addSkill(leadId, data),
    onSuccess: () => {
      toast.success('Skill added successfully');
      setShowAddModal(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add skill');
    },
  });

  const updateSkillMutation = useMutation({
    mutationFn: (data: Partial<{ name: string; category?: string; level?: 'beginner' | 'experienced'; toolsAvailable?: boolean }>) =>
      caosApi.updateSkill(leadId, selectedSkillIndex!, data),
    onSuccess: () => {
      toast.success('Skill updated successfully');
      setShowEditModal(false);
      setSelectedSkillIndex(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update skill');
    },
  });

  const removeSkillMutation = useMutation({
    mutationFn: (index: number) => caosApi.removeSkill(leadId, index),
    onSuccess: () => {
      toast.success('Skill removed successfully');
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to remove skill');
    },
  });

  const resetForm = () => {
    setSkillName('');
    setSkillCategory('');
    setSkillLevel('experienced');
    setToolsAvailable(false);
  };

  const handleAdd = () => {
    if (skillName.trim()) {
      addSkillMutation.mutate({
        name: skillName,
        category: skillCategory || undefined,
        level: skillLevel,
        toolsAvailable,
      });
    }
  };

  const handleEdit = (index: number) => {
    const skill = lead.skills[index];
    setSelectedSkillIndex(index);
    setSkillName(skill.name);
    setSkillCategory(skill.category || '');
    setSkillLevel(skill.level || 'experienced');
    setToolsAvailable(skill.toolsAvailable || false);
    setShowEditModal(true);
  };

  const handleUpdate = () => {
    if (skillName.trim() && selectedSkillIndex !== null) {
      updateSkillMutation.mutate({
        name: skillName,
        category: skillCategory || undefined,
        level: skillLevel,
        toolsAvailable,
      });
    }
  };

  const handleDelete = (index: number) => {
    if (confirm('Are you sure you want to remove this skill?')) {
      removeSkillMutation.mutate(index);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Skills</CardTitle>
          {canEditSkills && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Skill
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!canEditSkills && lead.creationMethod !== 'bulk_upload' && !authLoading && (
            <p className="mb-3 text-sm text-gray-600">
              Only the user who created this lead can edit skills.
            </p>
          )}
          {lead.skills.length === 0 && !lead.primaryCategory && !(lead as any).primarySkill ? (
            <p className="text-sm text-gray-600">No skills assigned yet</p>
          ) : (
            <div className="space-y-3">
              {/* Show primary category/skill if skills array is empty but primaryCategory exists */}
              {lead.skills.length === 0 && (lead.primaryCategory || (lead as any).primarySkill) && (
                <div className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50">
                  <Briefcase className="h-5 w-5 text-gray-400" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">
                        {categoryDisplay(lead.primaryCategory || (lead as any).primarySkill, lead.secondaryCategory || (lead as any).secondarySkill)}
                      </p>
                      <Badge className="border border-gray-200 bg-gray-50 text-gray-700">
                        Primary Category
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
              {lead.skills.map((skill, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Briefcase className="h-5 w-5 text-gray-400" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{skill.name}</p>
                        {skill.category && (
                          <Badge className="border border-gray-200 bg-gray-50 text-gray-700">{skill.category}</Badge>
                        )}
                        {skill.level && (
                          <Badge className="capitalize border border-gray-200 bg-gray-50 text-gray-700">
                            {skill.level}
                          </Badge>
                        )}
                        {skill.toolsAvailable && (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Tools Available
                          </Badge>
                        )}
                      </div>
                      {skill.assignedAt && (
                        <p className="text-xs text-gray-500 mt-1">
                          Assigned: {new Date(skill.assignedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  {canEditSkills && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(index)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(index)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Skill Modal */}
      {showAddModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddModal(false);
              resetForm();
            }
          }}
        >
          <Card className="w-full max-w-md bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Add Skill</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="skill-name-input">Skill Name *</Label>
                <Input
                  id="skill-name-input"
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                  placeholder="e.g., Plumber, Electrician"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="skill-category-input">Category (Optional)</Label>
                <Input
                  id="skill-category-input"
                  value={skillCategory}
                  onChange={(e) => setSkillCategory(e.target.value)}
                  placeholder="e.g., Home Services, Technical"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="skill-level-select">Level</Label>
                <Select
                  value={skillLevel}
                  onValueChange={(value) => setSkillLevel(value as 'beginner' | 'experienced')}
                >
                  <SelectTrigger id="skill-level-select">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="experienced">Experienced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="toolsAvailable"
                  checked={toolsAvailable}
                  onChange={(e) => setToolsAvailable(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="toolsAvailable" className="cursor-pointer">Tools Available</Label>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleAdd}
                  disabled={addSkillMutation.isPending || !skillName.trim()}
                  className="flex-1"
                >
                  {addSkillMutation.isPending ? 'Adding...' : 'Add Skill'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  disabled={addSkillMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Skill Modal */}
      {showEditModal && selectedSkillIndex !== null && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowEditModal(false);
              setSelectedSkillIndex(null);
              resetForm();
            }
          }}
        >
          <Card className="w-full max-w-md bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Edit Skill</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-skill-name-input">Skill Name *</Label>
                <Input
                  id="edit-skill-name-input"
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                  placeholder="e.g., Plumber, Electrician"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-skill-category-input">Category (Optional)</Label>
                <Input
                  id="edit-skill-category-input"
                  value={skillCategory}
                  onChange={(e) => setSkillCategory(e.target.value)}
                  placeholder="e.g., Home Services, Technical"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-skill-level-select">Level</Label>
                <Select
                  value={skillLevel}
                  onValueChange={(value) => setSkillLevel(value as 'beginner' | 'experienced')}
                >
                  <SelectTrigger id="edit-skill-level-select">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="experienced">Experienced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="toolsAvailableEdit"
                  checked={toolsAvailable}
                  onChange={(e) => setToolsAvailable(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="toolsAvailableEdit" className="cursor-pointer">Tools Available</Label>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleUpdate}
                  disabled={updateSkillMutation.isPending || !skillName.trim()}
                  className="flex-1"
                >
                  {updateSkillMutation.isPending ? 'Updating...' : 'Update Skill'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedSkillIndex(null);
                    resetForm();
                  }}
                  disabled={updateSkillMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

