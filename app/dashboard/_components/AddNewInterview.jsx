"use client";
import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { chatSession, fallbackChatSession } from "@/utils/GeminiAIModal";
import { LoaderCircle, Sparkles } from "lucide-react";
import { MockInterview } from "@/utils/schema";
import { v4 as uuidv4 } from 'uuid';
import { db } from "@/utils/db";
import { useUser } from "@clerk/nextjs";
import moment from "moment";
import { useRouter } from "next/navigation";
import { toast } from "sonner";


// Job Role Suggestions
const JOB_ROLE_SUGGESTIONS = [
  'Full Stack Developer',
  'Frontend Developer',
  'Backend Developer',
  'Software Engineer',
  'DevOps Engineer',
  'Data Scientist',
  'Machine Learning Engineer',
  'Cloud Engineer',
  'Mobile App Developer',
  'UI/UX Designer'
];

// Tech Stack Suggestions
const TECH_STACK_SUGGESTIONS = {
  'Full Stack Developer': 'React, Node.js, Express, MongoDB, TypeScript',
  'Frontend Developer': 'React, Vue.js, Angular, TypeScript, Tailwind CSS',
  'Backend Developer': 'Python, Django, Flask, Java Spring, PostgreSQL',
  'Software Engineer': 'Java, C++, Python, AWS, Microservices',
  'DevOps Engineer': 'Docker, Kubernetes, Jenkins, AWS, Azure',
  'Data Scientist': 'Python, TensorFlow, PyTorch, Pandas, NumPy',
  'Machine Learning Engineer': 'Python, scikit-learn, Keras, TensorFlow',
  'Cloud Engineer': 'AWS, Azure, GCP, Terraform, Kubernetes',
  'Mobile App Developer': 'React Native, Flutter, Swift, Kotlin',
  'UI/UX Designer': 'Figma, Sketch, Adobe XD, InVision'
};

function AddNewInterview({ isOpen, setIsOpen }) {
  const [jobPosition, setJobPosition] = useState();
  const [jobDescription, setJobDescription] = useState();
  const [jobExperience, setJobExperience] = useState();
  const [loading, setLoading] = useState(false);
  const [jsonResponse,setJsonResponse] = useState([]);
  const { user } = useUser();
  const router = useRouter();

  // Auto-suggest tech stack based on job role
  const autoSuggestTechStack = (role) => {
    const suggestion = TECH_STACK_SUGGESTIONS[role];
    if (suggestion) {
      setJobDescription(suggestion);
      toast.info(`Auto-filled tech stack for ${role}`);
    }
  };

  const handleSuccess = async (mockResponse) => {
    const res = await db.insert(MockInterview)
      .values({
        mockId: uuidv4(),
        jsonMockResp: JSON.stringify(mockResponse),
        jobPosition: jobPosition,
        jobDesc: jobDescription,
        jobExperience: jobExperience,
        createdBy: user?.primaryEmailAddress?.emailAddress,
        createdAt: moment().format('DD-MM-YYYY'),
      }).returning({ mockId: MockInterview.mockId });

    toast.success('Interview questions generated successfully!');
    router.push(`/dashboard/interview/${res[0]?.mockId}`);
  };

  const onSubmit = async (e) => {
    setLoading(true);
    e.preventDefault();
  
    const inputPrompt = `Job position: ${jobPosition}, Job Description: ${jobDescription}, Years of Experience: ${jobExperience}.
    Generate ${process.env.NEXT_PUBLIC_INTERVIEW_QUESTION_COUNT} interview questions and answers in JSON format.`;

    try{
      // Primary model attempt
      try {
        const result = await chatSession.sendMessage(inputPrompt);
        const mockResponse = JSON.parse(result.response.text());
        setJsonResponse(result.response.text());
        if (mockResponse) {
          await handleSuccess(mockResponse);
          return;
        }
      } catch (error) {
        console.warn("Primary model failed, trying fallback:", error);
      }

      // Fallback model attempt
      const fallbackResult = await fallbackChatSession.sendMessage(inputPrompt);
      const fallbackMockResponse = JSON.parse(fallbackResult.response.text());
      setJsonResponse(fallbackResult.response.text());
      if (fallbackMockResponse) {
        await handleSuccess(fallbackMockResponse);
      }

    } catch (error) {
      console.error("Error generating interview with both models:", error);
      toast.error('The AI model is currently overloaded. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div
        className="p-10 border rounded-lg bg-secondary hover:scale-105 hover:shadow-md cursor-pointer transition-all"
        onClick={() => setIsOpen(true)}
      >
        <h1 className="font-bold text-lg text-center">+ Add New</h1>
      </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              Create Your Interview Preparation
            </DialogTitle>
            <DialogDescription>
              <form onSubmit={onSubmit}>
                <div>
                  <h2 className="">Add details about your job position/role, job description and years of experience</h2>
                  <div className="mt-7 my-3">
                    <label>Job Role/Position</label>
                    <div className="flex items-center space-x-2">
                      <Input
                        placeholder="Ex. Full Stack Developer"
                        value={jobPosition}
                        required
                        onChange={(e) => setJobPosition(e.target.value)}
                        list="jobRoles"
                        />
                      <datalist id="jobRoles">
                        {JOB_ROLE_SUGGESTIONS.map(role => (
                          <option key={role} value={role} />
                        ))}
                      </datalist>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => autoSuggestTechStack(jobPosition)}
                        disabled={!jobPosition}
                        >
                        <Sparkles className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="my-3">
                    <label>Job Description/Tech Stack</label>
                    <Textarea
                      placeholder="Ex. React, Angular, NodeJs, MySql etc"
                      value={jobDescription}
                      required
                      onChange={(e) => setJobDescription(e.target.value)}
                      />
                  </div>
                  <div className="my-3">
                    <label>Years of Experience</label>
                    <Input
                      placeholder="Ex. 5"
                      type="number"
                      min="0"
                      max="70"
                      value={jobExperience}
                      required
                      onChange={(e) => setJobExperience(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-5 justify-end">
                  <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? (
                      <>
                        <LoaderCircle className="animate-spin mr-2" /> Generating
                      </>
                    ) : (
                      'Start Interview'
                    )}
                  </Button>
                </div>
              </form>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AddNewInterview;